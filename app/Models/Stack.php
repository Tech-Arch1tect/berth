<?php

namespace App\Models;

class Stack
{
    public string $name;
    public string $path;
    public array $services;
    public array $networks;
    public bool $parsed_successfully;
    public ?array $service_status;

    public function __construct(array $data)
    {
        $this->name = $data['name'] ?? '';
        $this->path = $data['path'] ?? '';
        $this->services = $data['services'] ?? [];
        $this->networks = $data['networks'] ?? [];
        $this->parsed_successfully = $data['parsed_successfully'] ?? false;
        $this->service_status = $data['service_status'] ?? null;
    }

    public function getServiceCount(): int
    {
        return count($this->services);
    }

    public function getServiceNames(): array
    {
        return array_keys($this->services);
    }

    public function getPortMappings(): array
    {
        $ports = [];
        foreach ($this->services as $serviceName => $service) {
            if (isset($service['ports']) && is_array($service['ports'])) {
                foreach ($service['ports'] as $port) {
                    $ports[] = [
                        'service' => $serviceName,
                        'published' => $port['published'] ?? null,
                        'target' => $port['target'] ?? null,
                        'protocol' => $port['protocol'] ?? 'tcp',
                    ];
                }
            }
        }
        return $ports;
    }

    public function getVolumeMappings(): array
    {
        $volumes = [];
        foreach ($this->services as $serviceName => $service) {
            if (isset($service['volumes']) && is_array($service['volumes'])) {
                foreach ($service['volumes'] as $volume) {
                    $volumes[] = [
                        'service' => $serviceName,
                        'source' => $volume['source'] ?? null,
                        'target' => $volume['target'] ?? null,
                        'type' => $volume['type'] ?? 'bind',
                        'read_only' => $volume['read_only'] ?? false,
                    ];
                }
            }
        }
        return $volumes;
    }

    public function getRunningServicesCount(): int
    {
        if (!$this->service_status || !isset($this->service_status['services']) || !is_array($this->service_status['services'])) {
            return 0;
        }

        return count(array_filter($this->service_status['services'], function ($service) {
            return isset($service['state']) && $service['state'] === 'running';
        }));
    }

    public function getTotalServicesCount(): int
    {
        if (!$this->service_status || !isset($this->service_status['services'])) {
            return 0;
        }

        return is_array($this->service_status['services']) ? count($this->service_status['services']) : 0;
    }

    public function getServiceStatusSummary(): array
    {
        $totalDefinedServices = $this->getServiceCount();
        
        if (!$this->service_status || !isset($this->service_status['services']) || !is_array($this->service_status['services'])) {
            return ['running' => 0, 'stopped' => $totalDefinedServices, 'total' => $totalDefinedServices];
        }

        $running = 0;
        $stopped = 0;

        foreach ($this->service_status['services'] as $service) {
            if (isset($service['state'])) {
                if ($service['state'] === 'running') {
                    $running++;
                } else {
                    $stopped++;
                }
            }
        }

        // Account for services not appearing in status (they are stopped)
        $stoppedTotal = $totalDefinedServices - $running;

        return [
            'running' => $running,
            'stopped' => $stoppedTotal,
            'total' => $totalDefinedServices,
        ];
    }

    public function getOverallStatus(): string
    {
        if (!$this->service_status || !isset($this->service_status['services'])) {
            return 'unknown';
        }

        if (!is_array($this->service_status['services']) || empty($this->service_status['services'])) {
            return 'stopped';
        }

        $summary = $this->getServiceStatusSummary();
        
        if ($summary['running'] === 0) {
            return 'stopped';
        } elseif ($summary['running'] === $summary['total']) {
            return 'running';
        } else {
            return 'partial';
        }
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'path' => $this->path,
            'services' => $this->services,
            'networks' => $this->networks,
            'parsed_successfully' => $this->parsed_successfully,
            'service_count' => $this->getServiceCount(),
            'service_names' => $this->getServiceNames(),
            'port_mappings' => $this->getPortMappings(),
            'volume_mappings' => $this->getVolumeMappings(),
            'service_status' => $this->service_status,
            'running_services_count' => $this->getRunningServicesCount(),
            'total_services_count' => $this->getTotalServicesCount(),
            'service_status_summary' => $this->getServiceStatusSummary(),
            'overall_status' => $this->getOverallStatus(),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    public static function collection(array $stacksData): array
    {
        return array_map(fn($stackData) => self::fromArray($stackData), $stacksData);
    }
}