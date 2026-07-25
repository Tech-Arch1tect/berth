import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmationModal } from '../../../../shared/components/ConfirmationModal';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import {
  useGetApiV1AdminAgentAuthority,
  usePostApiV1AdminAgentAuthorityClientCertificate,
  usePostApiV1AdminAgentAuthorityRotate,
  usePostApiV1AdminServersIdAgentBundle,
  getGetApiV1AdminAgentAuthorityQueryKey,
  getGetApiV1AdminServersQueryKey,
} from '../../../../api/generated/admin/admin';
import type { ServerInfo } from '../../../../api/generated/models';

const EXPIRY_WARNING_DAYS = 90;

function formatCertificateDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(value?: string) {
  if (!value) return null;
  const remaining = new Date(value).getTime() - Date.now();
  return Math.floor(remaining / (24 * 60 * 60 * 1000));
}

function expiryNote(expiresAt?: string) {
  const remaining = daysUntil(expiresAt);
  if (remaining === null) return null;
  if (remaining < 0) return { text: 'Expired', className: theme.text.danger };
  if (remaining <= EXPIRY_WARNING_DAYS) {
    return {
      text: `Expires in ${remaining} day${remaining === 1 ? '' : 's'}`,
      className: theme.text.warning,
    };
  }
  return null;
}

function bundleFilename(server: ServerInfo) {
  const slug = server.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `berth-agent-${slug || 'server'}-${server.id}-certificates.tar.gz`;
}

function downloadBundle(bundle: Blob, server: ServerInfo) {
  const url = window.URL.createObjectURL(bundle);
  const link = document.createElement('a');
  link.href = url;
  link.download = bundleFilename(server);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function useIssuingAuthorityFingerprint() {
  const { data } = useGetApiV1AdminAgentAuthority();
  return data?.data?.authority?.authority_fingerprint;
}

function issuedByCurrentAuthority(server: ServerInfo, authorityFingerprint?: string) {
  if (!server.agent_cert_fingerprint) return false;
  if (!authorityFingerprint) return true;
  return server.agent_cert_authority_fingerprint === authorityFingerprint;
}

export function AgentCertificateBadge({ server }: { server: ServerInfo }) {
  const authorityFingerprint = useIssuingAuthorityFingerprint();

  if (server.agent_cert_fingerprint && !issuedByCurrentAuthority(server, authorityFingerprint)) {
    return (
      <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>Reissue required</span>
    );
  }
  if (!server.agent_cert_fingerprint) {
    return (
      <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>No certificate</span>
    );
  }
  const remaining = daysUntil(server.agent_cert_expires_at);
  if (remaining === null || remaining > EXPIRY_WARNING_DAYS) {
    return null;
  }
  return (
    <span className={cn(theme.badges.tag.base, theme.badges.tag.warning)}>
      {remaining < 0 ? 'Certificate expired' : 'Certificate expiring'}
    </span>
  );
}

interface AgentAuthorityPanelProps {
  onError: (title: string, message: string) => void;
}

export function AgentAuthorityPanel({ onError }: AgentAuthorityPanelProps) {
  const queryClient = useQueryClient();
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const { data: response, isLoading } = useGetApiV1AdminAgentAuthority();
  const authority = response?.data?.authority;

  const refreshCertificates = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminAgentAuthorityQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminServersQueryKey() });
  };

  const rotateMutation = usePostApiV1AdminAgentAuthorityRotate({
    mutation: {
      onSuccess: () => {
        refreshCertificates();
        setRotateConfirm(false);
      },
      onError: (error) => {
        setRotateConfirm(false);
        onError(
          'Rotation Failed',
          `Failed to rotate the certificate authority: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      },
    },
  });

  const reissueMutation = usePostApiV1AdminAgentAuthorityClientCertificate({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getGetApiV1AdminAgentAuthorityQueryKey() }),
      onError: (error) =>
        onError(
          'Reissue Failed',
          `Failed to reissue the client certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
    },
  });

  if (isLoading || !authority?.exists) {
    return null;
  }

  const authorityExpiry = expiryNote(authority.authority_expires_at);
  const clientExpiry = expiryNote(authority.client_expires_at);

  return (
    <div className={cn('mb-6 rounded-lg border p-4', theme.table.panel)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className={cn('text-sm font-semibold', theme.text.strong)}>Agent certificates</h2>
          <p className={cn('text-sm', theme.text.muted)}>
            Agents trust this authority. It signs the certificate berth presents to them and the
            certificate each agent presents back.
          </p>
          <p className={cn('text-xs', theme.text.subtle)}>
            Authority expires {formatCertificateDate(authority.authority_expires_at)}
            {authorityExpiry && (
              <span className={cn('ml-2', authorityExpiry.className)}>{authorityExpiry.text}</span>
            )}
          </p>
          <p className={cn('text-xs', theme.text.subtle)}>
            berth's certificate expires {formatCertificateDate(authority.client_expires_at)}
            {clientExpiry && (
              <span className={cn('ml-2', clientExpiry.className)}>{clientExpiry.text}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reissueMutation.mutate()}
            disabled={reissueMutation.isPending}
            className={cn(
              'inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
              theme.buttons.secondary
            )}
          >
            {reissueMutation.isPending ? 'Reissuing...' : 'Reissue berth certificate'}
          </button>
          <button
            type="button"
            onClick={() => setRotateConfirm(true)}
            disabled={rotateMutation.isPending}
            className={cn(
              'inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
              theme.buttons.danger
            )}
          >
            {rotateMutation.isPending ? 'Rotating...' : 'Rotate authority'}
          </button>
        </div>
      </div>

      {authority.agents_needing_reissue > 0 && (
        <p className={cn('mt-2 text-sm', theme.text.danger)}>
          {authority.agents_needing_reissue} agent
          {authority.agents_needing_reissue === 1 ? '' : 's'} still hold certificates from a
          previous authority. berth cannot reach{' '}
          {authority.agents_needing_reissue === 1 ? 'it' : 'them'} until a new bundle is installed
          on each one.
        </p>
      )}

      <p className={cn('mt-2 text-xs', theme.text.subtle)}>
        Agents trust the authority rather than berth's certificate, so reissuing that certificate
        does not require reinstalling anything on them. Rotating the authority replaces its key and
        does.
      </p>

      <ConfirmationModal
        isOpen={rotateConfirm}
        onClose={() => setRotateConfirm(false)}
        onConfirm={() => rotateMutation.mutate()}
        title="Rotate Certificate Authority"
        message="Replace the certificate authority and its key. Every certificate it has issued stops being trusted, so berth cannot reach any agent until you install a new bundle on each one. Use this if the authority is nearing expiry or its key may have been exposed."
        confirmText="Rotate"
        variant="danger"
        isLoading={rotateMutation.isPending}
      />
    </div>
  );
}

interface AgentCertificateSectionProps {
  server: ServerInfo;
  onError: (title: string, message: string) => void;
}

export function AgentCertificateSection({ server, onError }: AgentCertificateSectionProps) {
  const queryClient = useQueryClient();
  const authorityFingerprint = useIssuingAuthorityFingerprint();
  const issued = !!server.agent_cert_fingerprint;
  const stale = issued && !issuedByCurrentAuthority(server, authorityFingerprint);
  const expiry = expiryNote(server.agent_cert_expires_at);

  const issueMutation = usePostApiV1AdminServersIdAgentBundle({
    mutation: {
      onSuccess: (bundle) => {
        downloadBundle(bundle, server);
        queryClient.invalidateQueries({ queryKey: getGetApiV1AdminServersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetApiV1AdminAgentAuthorityQueryKey() });
      },
      onError: (error) =>
        onError(
          'Issue Failed',
          `Failed to issue the certificate bundle: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
    },
  });

  return (
    <div className={cn('rounded-md border p-4', theme.table.panel)}>
      <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Agent certificate</h3>
      {issued ? (
        <div className="mt-1 space-y-1">
          <p className={cn('text-xs font-mono break-all', theme.text.muted)}>
            {server.agent_cert_fingerprint?.slice(0, 16)}
          </p>
          <p className={cn('text-xs', theme.text.subtle)}>
            Issued {formatCertificateDate(server.agent_cert_issued_at)}, expires{' '}
            {formatCertificateDate(server.agent_cert_expires_at)}
            {expiry && <span className={cn('ml-2', expiry.className)}>{expiry.text}</span>}
          </p>
          {stale && (
            <p className={cn('text-sm', theme.text.danger)}>
              Issued by a previous authority, so berth no longer trusts it. Issue a new bundle and
              install it on this agent.
            </p>
          )}
        </div>
      ) : (
        <p className={cn('mt-1 text-sm', theme.text.muted)}>
          No certificate has been issued for this agent yet.
        </p>
      )}

      <button
        type="button"
        onClick={() => issueMutation.mutate({ id: server.id })}
        disabled={issueMutation.isPending}
        className={cn(
          'mt-3 inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
          theme.buttons.secondary
        )}
      >
        {issueMutation.isPending ? 'Issuing...' : issued ? 'Reissue bundle' : 'Issue bundle'}
      </button>

      <p className={cn('mt-2 text-sm', theme.text.subtle)}>
        Downloads server.crt, server.key and ca.crt for this agent. Place them in the agent's ssl
        directory. The key is only offered once: if it is lost, issue the bundle again.
        {issued &&
          !stale &&
          ' Issuing a new bundle stops the current certificate being accepted, so this agent is unreachable until the new files are installed on it.'}
      </p>
    </div>
  );
}
