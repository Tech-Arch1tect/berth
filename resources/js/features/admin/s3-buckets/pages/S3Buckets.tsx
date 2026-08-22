import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { Table } from '../../../../shared/components/Table';
import { Modal } from '../../../../shared/components/Modal';
import { ConfirmationModal } from '../../../../shared/components/ConfirmationModal';
import { LoadingSpinner } from '../../../../shared/components/LoadingSpinner';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { PencilSquareIcon, PlusIcon, TrashIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import {
  getGetApiV1AdminS3BucketsQueryKey,
  useDeleteApiV1AdminS3BucketsId,
  useGetApiV1AdminS3Buckets,
  usePostApiV1AdminS3Buckets,
  usePutApiV1AdminS3BucketsId,
} from '../../../../api/generated/s3-buckets/s3-buckets';
import type { BucketResponse } from '../../../../api/generated/models';

const EMPTY_FORM = {
  label: '',
  endpoint: '',
  region: 'us-east-1',
  bucket_name: '',
  access_key_id: '',
  secret_access_key: '',
};

export default function S3Buckets() {
  useDocumentTitle('S3 Buckets');
  const queryClient = useQueryClient();

  const { data: bucketsResponse, isLoading: bucketsLoading } = useGetApiV1AdminS3Buckets();
  const buckets = bucketsResponse?.data ?? [];

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBucket, setEditingBucket] = useState<BucketResponse | null>(null);
  const [bucketToDelete, setBucketToDelete] = useState<BucketResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createBucketMutation = usePostApiV1AdminS3Buckets();
  const updateBucketMutation = usePutApiV1AdminS3BucketsId();
  const deleteBucketMutation = useDeleteApiV1AdminS3BucketsId();

  const invalidateBuckets = () =>
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminS3BucketsQueryKey() });

  const openCreate = () => {
    setEditingBucket(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setShowFormModal(true);
  };

  const openEdit = (bucket: BucketResponse) => {
    setEditingBucket(bucket);
    setFormData({
      label: bucket.label,
      endpoint: bucket.endpoint,
      region: bucket.region,
      bucket_name: bucket.bucket_name,
      access_key_id: bucket.access_key_id,
      secret_access_key: '',
    });
    setErrors({});
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingBucket(null);
    setFormData(EMPTY_FORM);
    setErrors({});
  };

  const handleSaveBucket = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const onSuccess = () => {
      closeFormModal();
      invalidateBuckets();
    };
    const onError = (error: unknown) => {
      const errorData = error as { message?: string; errors?: Record<string, string> };
      if (errorData.errors) {
        setErrors(errorData.errors);
      } else {
        setErrors({ general: errorData.message || 'Failed to save the bucket' });
      }
    };

    if (editingBucket) {
      updateBucketMutation.mutate(
        {
          id: editingBucket.id,
          data: {
            label: formData.label,
            endpoint: formData.endpoint,
            region: formData.region,
            bucket_name: formData.bucket_name,
            access_key_id: formData.access_key_id,
            secret_access_key: formData.secret_access_key,
          },
        },
        { onSuccess, onError }
      );
    } else {
      createBucketMutation.mutate({ data: { ...formData } }, { onSuccess, onError });
    }
  };

  const confirmDeleteBucket = () => {
    if (!bucketToDelete) return;
    setDeleteError(null);

    deleteBucketMutation.mutate(
      { id: bucketToDelete.id },
      {
        onSuccess: () => {
          invalidateBuckets();
          setBucketToDelete(null);
        },
        onError: (err) => {
          const errorData = err as { message?: string; error?: string };
          setDeleteError(errorData.message || errorData.error || 'Failed to delete the bucket');
          setBucketToDelete(null);
        },
      }
    );
  };

  const bucketActions = (bucket: BucketResponse) => (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => openEdit(bucket)}
        aria-label={`Edit ${bucket.label}`}
        className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.secondary)}
      >
        <PencilSquareIcon className="h-4 w-4 mr-1.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => setBucketToDelete(bucket)}
        aria-label={`Delete ${bucket.label}`}
        className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.danger)}
      >
        <TrashIcon className="h-4 w-4 mr-1.5" />
        Delete
      </button>
    </div>
  );

  if (bucketsLoading) {
    return <LoadingSpinner size="lg" text="Loading S3 buckets..." fullScreen />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className={cn('text-2xl font-bold sm:text-3xl', theme.text.strong)}>S3 Buckets</h1>
          <button
            type="button"
            onClick={openCreate}
            className={cn('inline-flex items-center', theme.buttons.primary)}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Bucket
          </button>
        </div>

        {deleteError && (
          <div
            className={cn(
              'mb-4 p-4 rounded-md border',
              theme.intent.danger.surface,
              theme.intent.danger.border
            )}
          >
            <p className={cn('text-sm', theme.intent.danger.textStrong)}>{deleteError}</p>
          </div>
        )}

        <div className={theme.table.panel}>
          <Table<BucketResponse>
            data={buckets}
            keyExtractor={(bucket) => bucket.id.toString()}
            emptyMessage="No S3 buckets configured"
            emptyIcon={<ArchiveBoxIcon className={cn('h-12 w-12 mx-auto', theme.text.info)} />}
            defaultSortKey="label"
            searchValue={(bucket) => `${bucket.label} ${bucket.endpoint} ${bucket.bucket_name}`}
            searchPlaceholder="Search buckets by label, endpoint or bucket name"
            columns={[
              {
                key: 'label',
                header: 'Label',
                sortValue: (bucket) => bucket.label,
                render: (bucket) => (
                  <span className={cn('text-sm font-medium', theme.text.strong)}>
                    {bucket.label}
                  </span>
                ),
              },
              {
                key: 'endpoint',
                header: 'Endpoint',
                sortValue: (bucket) => bucket.endpoint,
                render: (bucket) => (
                  <span className={cn('font-mono text-xs', theme.text.muted)}>
                    {bucket.endpoint}
                  </span>
                ),
              },
              {
                key: 'bucket_name',
                header: 'Bucket',
                sortValue: (bucket) => bucket.bucket_name,
                render: (bucket) => (
                  <span className={cn('font-mono text-xs', theme.text.muted)}>
                    {bucket.bucket_name}
                  </span>
                ),
              },
              {
                key: 'region',
                header: 'Region',
                sortValue: (bucket) => bucket.region,
                render: (bucket) => (
                  <span className={cn('text-sm', theme.text.muted)}>{bucket.region}</span>
                ),
              },
              {
                key: 'access_key_id',
                header: 'Access Key',
                sortValue: (bucket) => bucket.access_key_id,
                render: (bucket) => (
                  <span className={cn('font-mono text-xs', theme.text.muted)}>
                    {bucket.access_key_id}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                render: bucketActions,
              },
            ]}
            renderCard={(bucket) => (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium', theme.text.strong)}>{bucket.label}</p>
                    <p className={cn('truncate font-mono text-xs', theme.text.muted)}>
                      {bucket.endpoint}/{bucket.bucket_name}
                    </p>
                  </div>
                  {bucketActions(bucket)}
                </div>
                <p className={cn('text-xs', theme.text.subtle)}>
                  Region {bucket.region} · Access key {bucket.access_key_id}
                </p>
              </div>
            )}
          />
        </div>
      </div>

      <Modal
        isOpen={showFormModal}
        onClose={closeFormModal}
        title={editingBucket ? `Edit ${editingBucket.label}` : 'Create Bucket'}
        size="md"
      >
        <form onSubmit={handleSaveBucket} className="space-y-4">
          <p className={cn('text-sm', theme.text.muted)}>
            {editingBucket
              ? 'Update the stored settings and credentials for this bucket.'
              : 'Add an S3-compatible bucket that servers can store their backups in. Credentials are encrypted on the berth server and sent to agents with backup requests.'}
          </p>

          {errors.general && (
            <div
              className={cn(
                'p-4 rounded-md border',
                theme.intent.danger.surface,
                theme.intent.danger.border
              )}
            >
              <p className={cn('text-sm', theme.intent.danger.textStrong)}>{errors.general}</p>
            </div>
          )}

          <div>
            <label htmlFor="bucket-label" className={theme.forms.label}>
              Label
            </label>
            <input
              type="text"
              id="bucket-label"
              required
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className={cn('mt-1', theme.forms.input)}
            />
          </div>

          <div>
            <label htmlFor="bucket-endpoint" className={theme.forms.label}>
              Endpoint
            </label>
            <input
              type="text"
              id="bucket-endpoint"
              required
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              className={cn('mt-1 font-mono text-sm', theme.forms.input)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bucket-name" className={theme.forms.label}>
                Bucket Name
              </label>
              <input
                type="text"
                id="bucket-name"
                required
                value={formData.bucket_name}
                onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                className={cn('mt-1 font-mono text-sm', theme.forms.input)}
              />
            </div>
            <div>
              <label htmlFor="bucket-region" className={theme.forms.label}>
                Region
              </label>
              <input
                type="text"
                id="bucket-region"
                required
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className={cn('mt-1 font-mono text-sm', theme.forms.input)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="bucket-access-key" className={theme.forms.label}>
              Access Key ID
            </label>
            <input
              type="text"
              id="bucket-access-key"
              required
              value={formData.access_key_id}
              onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
              className={cn('mt-1 font-mono text-sm', theme.forms.input)}
            />
          </div>

          <div>
            <label htmlFor="bucket-secret" className={theme.forms.label}>
              Secret Access Key
            </label>
            <input
              type="password"
              id="bucket-secret"
              autoComplete="new-password"
              required={!editingBucket}
              value={formData.secret_access_key}
              onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
              placeholder={editingBucket ? 'Leave blank to keep the stored secret' : undefined}
              className={cn('mt-1 font-mono text-sm', theme.forms.input)}
            />
            {editingBucket && (
              <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                Leave blank to keep the stored secret access key.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeFormModal} className={theme.buttons.secondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBucketMutation.isPending || updateBucketMutation.isPending}
              className={cn(
                theme.buttons.primary,
                (createBucketMutation.isPending || updateBucketMutation.isPending) &&
                  'disabled:opacity-50'
              )}
            >
              {createBucketMutation.isPending || updateBucketMutation.isPending
                ? 'Saving...'
                : editingBucket
                  ? 'Save Changes'
                  : 'Create Bucket'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={bucketToDelete !== null}
        onClose={() => setBucketToDelete(null)}
        onConfirm={confirmDeleteBucket}
        title="Delete Bucket"
        message={`Are you sure you want to delete the configuration for "${bucketToDelete?.label}"? The bucket and its contents in S3 are not touched; only the stored credentials and settings are removed.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteBucketMutation.isPending}
      />
    </div>
  );
}
