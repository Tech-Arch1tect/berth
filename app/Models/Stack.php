<?php

namespace App\Models;

class Stack
{
    public string $name;
    public string $path;
    public array $services;
    public array $networks;
    public bool $parsed_successfully;

    public function __construct(array $data)
    {
        $this->name = $data['name'] ?? '';
        $this->path = $data['path'] ?? '';
        $this->services = $data['services'] ?? [];
        $this->networks = $data['networks'] ?? [];
        $this->parsed_successfully = $data['parsed_successfully'] ?? false;
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