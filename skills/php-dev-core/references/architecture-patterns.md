# Architecture Patterns Reference

Framework-agnostic PHP patterns. No `di.xml`, no Magento-specific service contracts — plain PHP with PSR standards.

## Service Pattern

Services encapsulate business logic. They depend on interfaces, not concrete classes, and are stateless.

```php
<?php
declare(strict_types=1);

namespace Vendor\Package\Service;

use Vendor\Package\Repository\UserRepositoryInterface;
use Psr\Log\LoggerInterface;

final class UserService
{
    public function __construct(
        private readonly UserRepositoryInterface $repository,
        private readonly LoggerInterface $logger,
    ) {}

    public function findActive(int $id): ?UserDto
    {
        $user = $this->repository->find($id);
        if ($user === null || $user->status !== Status::Active) {
            $this->logger->info('User not found or inactive', ['id' => $id]);
            return null;
        }
        return $user;
    }
}
```

Rules:

- Constructor injection only — never use service locators or static `getInstance()`.
- One responsibility per service; split when the class exceeds ~200 lines.
- Return DTOs or value objects, not raw arrays.

## DTO — Readonly Class

Use `readonly class` (PHP 8.1+) for immutable data transfer objects.

```php
<?php
declare(strict_types=1);

namespace Vendor\Package\Dto;

final readonly class UserDto
{
    public function __construct(
        public int $id,
        public string $email,
        public string $name,
        public Status $status,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            id: (int) $data['id'],
            email: (string) $data['email'],
            name: (string) $data['name'],
            status: Status::from((string) $data['status']),
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'status' => $this->status->value,
        ];
    }
}

enum Status: string
{
    case Active = 'active';
    case Inactive = 'inactive';
}
```

Benefits: immutability prevents accidental mutation, `readonly` enforces initialization, `enum` restricts values.

## Factory Pattern

Factories create objects when construction needs logic or when callers should not know the concrete class.

```php
<?php
declare(strict_types=1);

namespace Vendor\Package\Factory;

use Vendor\Package\Dto\UserDto;
use Vendor\Package\Dto\Status;

final class UserDtoFactory
{
    public function create(array $row): UserDto
    {
        return new UserDto(
            id: (int) $row['id'],
            email: (string) $row['email'],
            name: (string) $row['name'],
            status: Status::from((string) $row['status']),
        );
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return list<UserDto>
     */
    public function createMany(array $rows): array
    {
        return array_map(fn (array $row) => $this->create($row), $rows);
    }
}
```

For heavy objects or test doubles, extract an interface `UserDtoFactoryInterface` and bind it in the container.

## Generic Container — PSR-11

For framework-agnostic DI, use a PSR-11 container. No `di.xml`; bindings are plain PHP.

```php
<?php
declare(strict_types=1);

namespace Vendor\Package\Container;

use Psr\Container\ContainerInterface;
use Vendor\Package\Repository\UserRepositoryInterface;
use Vendor\Package\Repository\PdoUserRepository;
use Vendor\Package\Service\UserService;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

// Simple PSR-11 container with explicit bindings
final class ContainerFactory
{
    public static function create(\PDO $pdo): ContainerInterface
    {
        return new class($pdo) implements ContainerInterface {
            private array $entries = [];

            public function __construct(private readonly \PDO $pdo)
            {
                $this->entries[LoggerInterface::class] = new NullLogger();
                $this->entries[UserRepositoryInterface::class] = new PdoUserRepository($this->pdo);
                $this->entries[UserService::class] = new UserService(
                    $this->get(UserRepositoryInterface::class),
                    $this->get(LoggerInterface::class),
                );
            }

            public function get(string $id): mixed
            {
                if (!$this->has($id)) {
                    throw new class("No entry for $id") extends \Exception implements \Psr\Container\NotFoundExceptionInterface {};
                }
                return $this->entries[$id];
            }

            public function has(string $id): bool
            {
                return isset($this->entries[$id]);
            }
        };
    }
}

// Usage
$container = ContainerFactory::create($pdo);
$service = $container->get(UserService::class);
$user = $service->findActive(42);
```

For larger projects, use an existing PSR-11 container (PHP-DI, League Container, Symfony DI standalone) instead of hand-rolling. The principle stays: bindings are explicit PHP, not XML.

## Composition Over Inheritance

- Prefer composition (inject collaborators) over deep inheritance hierarchies.
- Use interfaces for seams that need mocking or swapping.
- Keep inheritance shallow (one level) when used — abstract base only for shared template method.

## Testing Seams

- Services depend on interfaces — mock the interface in unit tests.
- DTOs are value objects — assert with `assertEquals` on `toArray()` or direct property comparison.
- Factories are pure — test `create` with known arrays, no mocks needed.
