package s3buckets

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var (
	ErrLabelRequired     = errors.New("a label is required")
	ErrEndpointInvalid   = errors.New("the endpoint must be an http or https URL including the port, for example https://s3.example.com:443")
	ErrBucketNameInvalid = errors.New("the bucket name must be 3 to 63 characters of lowercase letters, numbers, dots and hyphens")
	ErrAccessKeyRequired = errors.New("an access key id is required")
	ErrSecretKeyRequired = errors.New("a secret access key is required")
	ErrBucketInUse       = errors.New("this bucket configuration is assigned to a server")
	ErrBucketBusy        = errors.New("backup storage assignments are changing; try again once they finish")
)

var bucketNameRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`)

type CreateRequest struct {
	Label       string `json:"label"`
	Endpoint    string `json:"endpoint"`
	Region      string `json:"region"`
	BucketName  string `json:"bucket_name"`
	AccessKeyID string `json:"access_key_id"`
	SecretKey   string `json:"secret_access_key"`
}

type UpdateRequest struct {
	Label       string `json:"label"`
	Endpoint    string `json:"endpoint"`
	Region      string `json:"region"`
	BucketName  string `json:"bucket_name"`
	AccessKeyID string `json:"access_key_id"`
	SecretKey   string `json:"secret_access_key"`
}

type BucketResponse struct {
	ID          uint   `json:"id"`
	Label       string `json:"label"`
	Endpoint    string `json:"endpoint"`
	Region      string `json:"region"`
	BucketName  string `json:"bucket_name"`
	AccessKeyID string `json:"access_key_id"`
}

type ListResponse struct {
	Buckets []BucketResponse `json:"buckets"`
}

type DeleteResponse struct {
	Message string `json:"message"`
}

func (r *CreateRequest) Validate() error {
	if strings.TrimSpace(r.Label) == "" {
		return ErrLabelRequired
	}
	if err := validateEndpoint(r.Endpoint); err != nil {
		return err
	}
	if r.Region == "" {
		r.Region = "us-east-1"
	}
	if !bucketNameRegex.MatchString(r.BucketName) {
		return ErrBucketNameInvalid
	}
	if strings.TrimSpace(r.AccessKeyID) == "" {
		return ErrAccessKeyRequired
	}
	if r.SecretKey == "" {
		return ErrSecretKeyRequired
	}
	return nil
}

func (r *UpdateRequest) Validate() error {
	if strings.TrimSpace(r.Label) == "" {
		return ErrLabelRequired
	}
	if err := validateEndpoint(r.Endpoint); err != nil {
		return err
	}
	if r.Region == "" {
		r.Region = "us-east-1"
	}
	if !bucketNameRegex.MatchString(r.BucketName) {
		return ErrBucketNameInvalid
	}
	if strings.TrimSpace(r.AccessKeyID) == "" {
		return ErrAccessKeyRequired
	}
	return nil
}

func validateEndpoint(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ErrEndpointInvalid
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("%w; got scheme %q", ErrEndpointInvalid, parsed.Scheme)
	}
	return nil
}

func responseFrom(bucket *S3Bucket) BucketResponse {
	return BucketResponse{
		ID:          bucket.ID,
		Label:       bucket.Label,
		Endpoint:    bucket.Endpoint,
		Region:      bucket.Region,
		BucketName:  bucket.BucketName,
		AccessKeyID: bucket.AccessKeyID,
	}
}
