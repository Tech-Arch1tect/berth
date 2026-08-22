import { createFileRoute } from '@tanstack/react-router';
import S3Buckets from '../../../features/admin/s3-buckets/pages/S3Buckets';

export const Route = createFileRoute('/_app/admin/s3-buckets')({
  component: S3Buckets,
});
