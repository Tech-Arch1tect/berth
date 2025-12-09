import { StackDetails } from '../types/stack';

export const generateStackDocumentation = (stackDetails: StackDetails): string => {
  const { name, path, compose_file, services, server_name } = stackDetails;

  let doc = `# ${name} Stack Documentation\n\n`;
  doc += `**Generated**: ${new Date().toLocaleString()}\n\n`;

  // Stack Information
  doc += `## Stack Information\n\n`;
  doc += `- **Name**: ${name}\n`;
  doc += `- **Server**: ${server_name}\n`;
  doc += `- **Path**: ${path}\n`;
  doc += `- **Compose File**: ${compose_file}\n\n`;

  // Services
  doc += `## Services\n\n`;

  services.forEach((service) => {
    doc += `### ${service.name}\n\n`;

    if (service.image) {
      doc += `- **Image**: ${service.image}\n`;
    }

    if (service.scale) {
      doc += `- **Scale**: ${service.scale} replicas\n`;
    }

    if (service.restart) {
      doc += `- **Restart Policy**: ${service.restart}\n`;
    }

    if (service.command && service.command.length > 0) {
      doc += `- **Command**: ${service.command.join(' ')}\n`;
    }

    if (service.environment && Object.keys(service.environment).length > 0) {
      doc += `- **Environment Variables**: ${Object.keys(service.environment).length} defined\n`;
    }

    if (service.labels && Object.keys(service.labels).length > 0) {
      doc += `- **Labels**: ${Object.keys(service.labels).length} defined\n`;
    }

    if (service.depends_on && service.depends_on.length > 0) {
      doc += `- **Depends On**: ${service.depends_on.join(', ')}\n`;
    }

    if (service.profiles && service.profiles.length > 0) {
      doc += `- **Profiles**: ${service.profiles.join(', ')}\n`;
    }

    // Container status
    if (service.containers && service.containers.length > 0) {
      const running = service.containers.filter((c) => c.state === 'running').length;
      doc += `- **Containers**: ${running}/${service.containers.length} running\n`;

      service.containers.forEach((container) => {
        doc += `  - ${container.name} (${container.state})\n`;

        if (container.ports && container.ports.length > 0) {
          const ports = container.ports.map((p) => `${p.public}:${p.private}/${p.type}`);
          doc += `    - **Ports**: ${ports.join(', ')}\n`;
        }

        if (container.health?.status) {
          doc += `    - **Health**: ${container.health.status}\n`;
        }
      });
    }

    doc += '\n';
  });

  return doc;
};

export const downloadMarkdown = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (content: string): Promise<void> => {
  await navigator.clipboard.writeText(content);
};
