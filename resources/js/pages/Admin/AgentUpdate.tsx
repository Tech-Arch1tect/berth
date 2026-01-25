import { useState, useCallback, useEffect, useRef } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { Modal } from '../../components/common/Modal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { useAgentDiscovery } from '../../hooks/useAgentDiscovery';
import { useServerSelection } from '../../hooks/useServerSelection';
import { useAgentUpdateExecution } from '../../hooks/useAgentUpdateExecution';
import {
  AgentDiscoveryTable,
  UpdateConfigForm,
  UpdateProgressTable,
} from '../../components/agent-update';

interface Props {
  title?: string;
}

export default function AgentUpdate({ title = 'Agent Updates' }: Props) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  const { servers, loading, error, discover, agentServers } = useAgentDiscovery();

  const { selectedIds, toggle, selectAll, deselectAll, selectedCount, setSelected } =
    useServerSelection();

  const {
    isUpdating,
    progress,
    currentServerIndex,
    startUpdate,
    cancelUpdate,
    resetProgress,
    successCount,
    failedCount,
    skippedCount,
  } = useAgentUpdateExecution({ csrfToken });

  const [changeTag, setChangeTag] = useState(false);
  const [pullImages, setPullImages] = useState(true);
  const [newTag, setNewTag] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>(
    {
      isOpen: false,
      title: '',
      message: '',
    }
  );

  const hasAutoSelected = useRef(false);

  useEffect(() => {
    if (!loading && agentServers.length > 0 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      const agentIds = agentServers.map((s) => s.serverId);
      setSelected(agentIds);
    }
  }, [loading, agentServers, setSelected]);

  const selectedAgentServers = agentServers.filter((s) => selectedIds.has(s.serverId));

  const handleSelectAll = useCallback(() => {
    const agentIds = agentServers.map((s) => s.serverId);
    selectAll(agentIds);
  }, [agentServers, selectAll]);

  const handleStartUpdate = useCallback(async () => {
    if (selectedAgentServers.length === 0) {
      setErrorModal({
        isOpen: true,
        title: 'No Agents Selected',
        message: 'Please select at least one agent to update.',
      });
      return;
    }

    if (changeTag && !newTag.trim()) {
      setErrorModal({
        isOpen: true,
        title: 'Tag Required',
        message: 'Please enter a new image tag when "Change image tag" is enabled.',
      });
      return;
    }

    setShowConfirmModal(false);
    await startUpdate(selectedAgentServers, { changeTag, pullImages, newTag });
  }, [selectedAgentServers, changeTag, newTag, pullImages, startUpdate]);

  const handleReset = useCallback(() => {
    hasAutoSelected.current = false;
    resetProgress();
    discover();
  }, [resetProgress, discover]);

  return (
    <>
      <Head title={title} />

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className={cn('text-xl font-semibold', theme.text.strong)}>Agent Updates</h1>
            <p className={cn('mt-2 text-sm', theme.text.muted)}>
              Update berth-agent containers across all servers. Updates are executed sequentially
              with health checks after each update.
            </p>
          </div>

          {/* Discovery Section */}
          <AgentDiscoveryTable
            servers={servers}
            agentServers={agentServers}
            selectedServerIds={selectedIds}
            loading={loading}
            error={error}
            isUpdating={isUpdating}
            onToggleSelection={toggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={deselectAll}
            onRefresh={discover}
          />

          {/* Update Configuration */}
          {!isUpdating && progress.length === 0 && (
            <UpdateConfigForm
              changeTag={changeTag}
              pullImages={pullImages}
              newTag={newTag}
              selectedCount={selectedCount}
              onChangeTagToggle={setChangeTag}
              onPullImagesToggle={setPullImages}
              onNewTagChange={setNewTag}
              onStartUpdate={() => setShowConfirmModal(true)}
            />
          )}

          {/* Progress Section */}
          {(isUpdating || progress.length > 0) && (
            <UpdateProgressTable
              progress={progress}
              currentServerIndex={currentServerIndex}
              isUpdating={isUpdating}
              successCount={successCount}
              failedCount={failedCount}
              skippedCount={skippedCount}
              onCancel={cancelUpdate}
              onReset={handleReset}
            />
          )}

          {/* Confirmation Modal */}
          <ConfirmationModal
            isOpen={showConfirmModal}
            onClose={() => setShowConfirmModal(false)}
            onConfirm={handleStartUpdate}
            title="Confirm Agent Update"
            message={`Are you sure you want to update ${selectedAgentServers.length} berth-agent(s)? Actions: ${[
              changeTag ? `change tag to "${newTag}"` : null,
              pullImages ? 'pull images' : null,
              'restart all services',
            ]
              .filter(Boolean)
              .join(
                ', '
              )}. Each service will be updated individually with breaks between operations.`}
            confirmText="Start Update"
            variant="warning"
          />

          {/* Error Modal */}
          <Modal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
            title={errorModal.title}
            size="sm"
            footer={
              <div className="flex justify-end">
                <button
                  onClick={() => setErrorModal({ isOpen: false, title: '', message: '' })}
                  className={theme.buttons.primary}
                >
                  OK
                </button>
              </div>
            }
          >
            <p className={theme.text.standard}>{errorModal.message}</p>
          </Modal>
        </div>
      </div>
    </>
  );
}
