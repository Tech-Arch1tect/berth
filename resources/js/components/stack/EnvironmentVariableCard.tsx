import { theme } from '../../theme';
import { EnvironmentVariable, ServiceEnvironment } from '../../types/stack';
import { cn } from '../../utils/cn';

interface EnvironmentVariableCardProps {
  serviceName: string;
  serviceEnvironments: ServiceEnvironment[];
}

const statusBadge = (source: EnvironmentVariable['source']) =>
  source === 'compose' ? theme.badges.tag.info : theme.badges.tag.success;

export const EnvironmentVariableCard = ({
  serviceName,
  serviceEnvironments,
}: EnvironmentVariableCardProps) => {
  const allVariables = serviceEnvironments.flatMap((env) => env.variables);
  const composeVariables = allVariables.filter((variable) => variable.source === 'compose');
  const runtimeOnlyVariables = allVariables.filter(
    (variable) =>
      variable.source === 'runtime' &&
      !composeVariables.some((composeVariable) => composeVariable.key === variable.key)
  );

  const renderVariable = (variable: EnvironmentVariable) => (
    <div
      key={`${variable.key}-${variable.source}`}
      className={cn(theme.surface.soft, 'rounded-lg p-3')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-sm font-semibold', theme.text.strong)}>
              {variable.key}
            </span>
            <span className={cn(theme.badges.tag.base, statusBadge(variable.source))}>
              {variable.source}
            </span>
            {variable.is_sensitive && (
              <span className={cn(theme.badges.tag.base, theme.badges.tag.warning)}>Sensitive</span>
            )}
            {variable.is_from_container && (
              <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                Active in Container
              </span>
            )}
          </div>
          <p className={cn('mt-2 font-mono text-xs break-all', theme.text.subtle)}>
            {variable.is_sensitive ? '***' : (variable.value ?? '(empty)')}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <article className={theme.containers.cardSoft}>
      <header className={cn(theme.containers.sectionHeader, 'mb-4')}>
        <div>
          <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{serviceName}</h3>
          <p className={cn('text-sm', theme.text.subtle)}>
            {allVariables.length} variable{allVariables.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {composeVariables.length > 0 && (
            <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
              {composeVariables.length} Compose
            </span>
          )}
          {runtimeOnlyVariables.length > 0 && (
            <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
              {runtimeOnlyVariables.length} Runtime
            </span>
          )}
        </div>
      </header>

      <div className="space-y-6">
        {composeVariables.length > 0 && (
          <section>
            <h4 className={cn('mb-3 text-sm font-semibold', theme.text.strong)}>
              Compose Variables ({composeVariables.length})
            </h4>
            <div className="space-y-2">{composeVariables.map(renderVariable)}</div>
          </section>
        )}

        {runtimeOnlyVariables.length > 0 && (
          <section>
            <h4 className={cn('mb-3 text-sm font-semibold', theme.text.strong)}>
              Runtime Only Variables ({runtimeOnlyVariables.length})
            </h4>
            <div className="space-y-2">{runtimeOnlyVariables.map(renderVariable)}</div>
          </section>
        )}
      </div>
    </article>
  );
};

export default EnvironmentVariableCard;
