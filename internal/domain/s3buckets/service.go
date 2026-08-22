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

type Service struct {
	db     *gorm.DB
	crypto *crypto.Crypto
	logger *zap.Logger
}

func NewService(db *gorm.DB, cryptoSvc *crypto.Crypto, logger *zap.Logger) *Service {
	return &Service{db: db, crypto: cryptoSvc, logger: logger}
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
	bucket, err := s.find(ctx, id)
	if err != nil {
		return nil, err
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

func (s *Service) Delete(ctx context.Context, id uint) error {
	bucket, err := s.find(ctx, id)
	if err != nil {
		return err
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
