package s3buckets

import (
	"errors"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

var (
	ErrLabelRequired            = errors.New("a label is required")
	ErrEndpointInvalid          = errors.New("the endpoint must be an http or https S3 API URL with a valid host and no user information, query, fragment or non-root path")
	ErrBucketNameInvalid        = errors.New("the bucket name must be 3 to 63 characters of lowercase letters, numbers, dots and hyphens")
	ErrAccessKeyRequired        = errors.New("an access key id is required")
	ErrSecretKeyRequired        = errors.New("a secret access key is required")
	ErrBucketInUse              = errors.New("this bucket configuration is assigned to a server")
	ErrBucketBusy               = errors.New("backup storage assignments are changing; try again once they finish")
	ErrBucketStorageUnavailable = errors.New("backup storage status is unavailable")
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
	SecretKey   string `json:"secret_access_key,omitempty"`
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
	endpoint, err := normaliseEndpoint(r.Endpoint)
	if err != nil {
		return err
	}
	r.Endpoint = endpoint
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
	endpoint, err := normaliseEndpoint(r.Endpoint)
	if err != nil {
		return err
	}
	r.Endpoint = endpoint
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

func normaliseEndpoint(raw string) (string, error) {
	if strings.ContainsFunc(raw, unicode.IsControl) {
		return "", ErrEndpointInvalid
	}
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", ErrEndpointInvalid
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.ForceQuery || strings.Contains(raw, "#") {
		return "", ErrEndpointInvalid
	}
	if path := parsed.EscapedPath(); path != "" && path != "/" {
		return "", ErrEndpointInvalid
	}

	host := parsed.Hostname()
	if host == "" || strings.HasSuffix(parsed.Host, ":") {
		return "", ErrEndpointInvalid
	}
	if port := parsed.Port(); port != "" {
		if _, err := strconv.ParseUint(port, 10, 16); err != nil {
			return "", ErrEndpointInvalid
		}
	}
	if strings.HasPrefix(parsed.Host, "[") {
		if address, err := netip.ParseAddr(host); err != nil || !address.Is6() {
			return "", ErrEndpointInvalid
		}
	} else {
		host = strings.TrimSuffix(host, ".")
		if len(host) == 0 || len(host) > 253 {
			return "", ErrEndpointInvalid
		}
		for label := range strings.SplitSeq(host, ".") {
			if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
				return "", ErrEndpointInvalid
			}
			for _, char := range label {
				if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '-' {
					return "", ErrEndpointInvalid
				}
			}
		}
	}
	if strings.EqualFold(host, "console.aws.amazon.com") || strings.EqualFold(host, "s3.console.aws.amazon.com") {
		return "", ErrEndpointInvalid
	}
	return strings.TrimSuffix(raw, "/"), nil
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
