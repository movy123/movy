import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  dashboard: path.join(root, "frontend", "app", "lib", "dashboard.ts"),
  admin: path.join(root, "frontend", "app", "lib", "admin.ts"),
  rides: path.join(root, "backend", "src", "modules", "rides", "routes.ts"),
  drivers: path.join(root, "backend", "src", "modules", "drivers", "routes.ts"),
  payments: path.join(root, "backend", "src", "modules", "payments", "routes.ts"),
  support: path.join(root, "backend", "src", "modules", "support", "routes.ts"),
  adminRoutes: path.join(root, "backend", "src", "modules", "admin", "routes.ts"),
  auth: path.join(root, "backend", "src", "modules", "auth", "routes.ts")
};

const contents = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, target]) => [key, await readFile(target, "utf8")])
  )
);

const contracts = [
  {
    name: "dashboard drivers listing",
    frontendFile: "dashboard",
    frontendPattern: '/api/v1/drivers?page=1&pageSize=50',
    backendFile: "drivers",
    backendPattern: 'path("/drivers")',
    requiresPagination: true
  },
  {
    name: "dashboard rides listing",
    frontendFile: "dashboard",
    frontendPattern: '/api/v1/rides?page=1&pageSize=100',
    backendFile: "rides",
    backendPattern: 'path("/rides")',
    requiresPagination: true
  },
  {
    name: "dashboard payments summary",
    frontendFile: "dashboard",
    frontendPattern: '/api/v1/payments/summary',
    backendFile: "payments",
    backendPattern: 'path("/payments/summary")'
  },
  {
    name: "admin support queue",
    frontendFile: "admin",
    frontendPattern: '/api/v1/support/tickets?page=1&pageSize=100',
    backendFile: "support",
    backendPattern: 'path("/support/tickets")',
    requiresPagination: true
  },
  {
    name: "admin incidents queue",
    frontendFile: "admin",
    frontendPattern: '/api/v1/admin/incidents?page=1&pageSize=100',
    backendFile: "adminRoutes",
    backendPattern: 'path("/admin/incidents")',
    requiresPagination: true
  },
  {
    name: "admin fraud queue",
    frontendFile: "admin",
    frontendPattern: '/api/v1/admin/fraud-signals?page=1&pageSize=100',
    backendFile: "adminRoutes",
    backendPattern: 'path("/admin/fraud-signals")',
    requiresPagination: true
  },
  {
    name: "admin users queue",
    frontendFile: "admin",
    frontendPattern: '/api/v1/admin/users?page=1&pageSize=100',
    backendFile: "adminRoutes",
    backendPattern: 'path("/admin/users")',
    requiresPagination: true
  },
  {
    name: "admin MFA login bridge",
    frontendFile: "admin",
    frontendPattern: '/api/v1/auth/mfa/verify',
    backendFile: "auth",
    backendPattern: 'path("/auth/mfa/verify")'
  }
];

const failures = [];

for (const contract of contracts) {
  const frontendContent = contents[contract.frontendFile];
  const backendContent = contents[contract.backendFile];

  if (!frontendContent.includes(contract.frontendPattern)) {
    failures.push(`[frontend] Missing pattern for ${contract.name}: ${contract.frontendPattern}`);
  }

  if (!backendContent.includes(contract.backendPattern)) {
    failures.push(`[backend] Missing route for ${contract.name}: ${contract.backendPattern}`);
  }

  if (contract.requiresPagination) {
    const hasPagination =
      backendContent.includes("parsePaginationQuery") && backendContent.includes("paginateItems(");

    if (!hasPagination) {
      failures.push(`[pagination] ${contract.name} is expected to be paginated but route file is missing pagination helpers`);
    }
  }
}

if (!contents.admin.includes("codePreview")) {
  failures.push("[auth] Admin workspace no longer handles development MFA code previews");
}

if (!contents.dashboard.includes("codePreview")) {
  failures.push("[auth] Dashboard no longer handles development MFA code previews");
}

if (failures.length > 0) {
  console.error("MOVY contract audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("MOVY contract audit passed");
