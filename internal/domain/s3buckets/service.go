package s3buckets

import (
	"context"
	"errors"
	"fmt"

	"berth/internal/pkg/crypto"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

var ErrBucketNotFound = errors.New("bucket configuration not found")

type S3Repository struct {
	URL         string `json:"url"`
	AccessKeyID string `json:"access_key_id"`
	SecretKey   string `json:"secret_access_key"`
	Region      string `json:"region,omitempty"`
}

type backupStorageTopology interface {
	ReserveBackupStorageTopologyWrite() (func(), error)
	ReserveBackupStorageWrites(serverIDs []uint) (func(), error)
	RequireEmptyBackupStorage(ctx context.Context, serverID uint) error
}

func (s *Service) RepositoryForServer(ctx context.Context, serverID uint, stackName string) (*S3Repository, error) {
	base, err := s.RepositoryBaseForServer(ctx, serverID)
	if err != nil || base == nil {
		return base, err
	}
	repository := *base
	repository.URL += "/stacks/" + stackName
	return &repository, nil
}

func (s *Service) RepositoryBaseForServer(ctx context.Context, serverID uint) (*S3Repository, error) {
	var bucketID *uint
	if err := s.db.WithContext(ctx).
		Table("servers").
		Where("id = ?", serverID).
		Select("s3_bucket_id").
		Scan(&bucketID).Error; err != nil {
		return nil, fmt.Errorf("failed to read the server's bucket assignment: %w", err)
	}
	if bucketID == nil || *bucketID == 0 {
		return nil, nil
	}

	bucket, err := s.find(ctx, *bucketID)
	if err != nil {
		return nil, err
	}
	secret, err := s.crypto.Decrypt(bucket.SecretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt the bucket's secret access key: %w", err)
	}
	return &S3Repository{
		URL:         fmt.Sprintf("s3:%s/%s/servers/%d", bucket.Endpoint, bucket.BucketName, serverID),
		AccessKeyID: bucket.AccessKeyID,
		SecretKey:   secret,
		Region:      bucket.Region,
	}, nil
}

type Service struct {
	db            *gorm.DB
	crypto        *crypto.Crypto
	backupStorage backupStorageTopology
	logger        *zap.Logger
}

func NewService(db *gorm.DB, cryptoSvc *crypto.Crypto, logger *zap.Logger) *Service {
	return &Service{db: db, crypto: cryptoSvc, logger: logger}
}

func (s *Service) SetBackupStorageTopology(storage backupStorageTopology) {
	s.backupStorage = storage
}

func (s *Service) Exists(ctx context.Context, id uint) (bool, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&S3Bucket{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check s3 bucket configuration: %w", err)
	}
	return count == 1, nil
}

func (s *Service) List(ctx context.Context) (*ListResponse, error) {
	var buckets []S3Bucket
	if err := s.db.WithContext(ctx).Order("label ASC").Find(&buckets).Error; err != nil {
		return nil, fmt.Errorf("failed to list bucket configurations: %w", err)
	}

	response := &ListResponse{Buckets: []BucketResponse{}}
	for i := range buckets {
		response.Buckets = append(response.Buckets, responseFrom(&buckets[i]))
	}
	return response, nil
}

func (s *Service) Get(ctx context.Context, id uint) (*BucketResponse, error) {
	bucket, err := s.find(ctx, id)
	if err != nil {
		return nil, err
	}
	response := responseFrom(bucket)
	return &response, nil
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (*BucketResponse, error) {
	secret, err := s.crypto.Encrypt(req.SecretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to protect the secret access key: %w", err)
	}

	bucket := &S3Bucket{
		Label:       req.Label,
		Endpoint:    req.Endpoint,
		Region:      req.Region,
		BucketName:  req.BucketName,
		AccessKeyID: req.AccessKeyID,
		SecretKey:   secret,
	}
	if err := s.db.WithContext(ctx).Create(bucket).Error; err != nil {
		return nil, fmt.Errorf("failed to create the bucket configuration: %w", err)
	}

	s.logger.Info("s3 bucket configuration created",
		zap.Uint("id", bucket.ID),
		zap.String("label", bucket.Label),
		zap.String("endpoint", bucket.Endpoint),
		zap.String("bucket_name", bucket.BucketName),
	)

	response := responseFrom(bucket)
	return &response, nil
}

func (s *Service) Update(ctx context.Context, id uint, req UpdateRequest) (*BucketResponse, error) {
	if s.backupStorage == nil {
		return nil, ErrBucketStorageUnavailable
	}
	releaseTopology, err := s.backupStorage.ReserveBackupStorageTopologyWrite()
	if err != nil {
		return nil, ErrBucketBusy
	}
	defer releaseTopology()

	bucket, err := s.find(ctx, id)
	if err != nil {
		return nil, err
	}
	identityChanged := bucket.Endpoint != req.Endpoint || bucket.BucketName != req.BucketName
	if identityChanged {
		serverIDs, err := s.assignedServerIDs(ctx, id)
		if err != nil {
			return nil, err
		}
		releaseServers, err := s.backupStorage.ReserveBackupStorageWrites(serverIDs)
		if err != nil {
			return nil, err
		}
		defer releaseServers()
		for _, serverID := range serverIDs {
			if err := s.backupStorage.RequireEmptyBackupStorage(ctx, serverID); err != nil {
				return nil, fmt.Errorf("server %d prevents the bucket identity change: %w", serverID, err)
			}
		}
	}

	bucket.Label = req.Label
	bucket.Endpoint = req.Endpoint
	bucket.Region = req.Region
	bucket.BucketName = req.BucketName
	bucket.AccessKeyID = req.AccessKeyID
	if req.SecretKey != "" {
		secret, err := s.crypto.Encrypt(req.SecretKey)
		if err != nil {
			return nil, fmt.Errorf("failed to protect the secret access key: %w", err)
		}
		bucket.SecretKey = secret
	}

	if err := s.db.WithContext(ctx).Save(bucket).Error; err != nil {
		return nil, fmt.Errorf("failed to save the bucket configuration: %w", err)
	}

	response := responseFrom(bucket)
	return &response, nil
}

func (s *Service) assignedServerIDs(ctx context.Context, bucketID uint) ([]uint, error) {
	var serverIDs []uint
	if err := s.db.WithContext(ctx).
		Table("servers").
		Where("s3_bucket_id = ?", bucketID).
		Order("id ASC").
		Pluck("id", &serverIDs).Error; err != nil {
		return nil, fmt.Errorf("failed to list servers assigned to the bucket configuration: %w", err)
	}
	return serverIDs, nil
}

func (s *Service) Delete(ctx context.Context, id uint) error {
	if s.backupStorage == nil {
		return ErrBucketBusy
	}
	release, err := s.backupStorage.ReserveBackupStorageTopologyWrite()
	if err != nil {
		return ErrBucketBusy
	}
	defer release()

	bucket, err := s.find(ctx, id)
	if err != nil {
		return err
	}

	var assigned int64
	if err := s.db.WithContext(ctx).
		Table("servers").
		Where("s3_bucket_id = ?", bucket.ID).
		Count(&assigned).Error; err != nil {
		return fmt.Errorf("failed to check whether the bucket configuration is in use: %w", err)
	}
	if assigned > 0 {
		return ErrBucketInUse
	}

	if err := s.db.WithContext(ctx).Delete(bucket).Error; err != nil {
		return fmt.Errorf("failed to delete the bucket configuration: %w", err)
	}

	s.logger.Info("s3 bucket configuration deleted",
		zap.Uint("id", bucket.ID),
		zap.String("label", bucket.Label),
	)
	return nil
}

func (s *Service) find(ctx context.Context, id uint) (*S3Bucket, error) {
	var bucket S3Bucket
	if err := s.db.WithContext(ctx).First(&bucket, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBucketNotFound
		}
		return nil, fmt.Errorf("failed to find the bucket configuration: %w", err)
	}
	return &bucket, nil
}
