import { PrismaClient, UserRole, RideType } from "@prisma/client";
import { hashPassword } from "../src/shared/security.js";

const prisma = new PrismaClient();

function readSeedValue(key: string, fallback: string) {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readSeedBoolean(key: string, fallback: boolean) {
  const value = process.env[key]?.trim();
  if (!value) {
    return fallback;
  }

  return value === "true";
}

async function ensureWallet(userId: string, balance: number) {
  await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      balance
    }
  });
}

async function ensureNotification(userId: string, title: string, message: string, level: "INFO" | "WARNING" | "CRITICAL") {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      title,
      message,
      level
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      level,
      channel: "IN_APP"
    }
  });
}

async function main() {
  const adminEmail = readSeedValue("MOVY_DEMO_ADMIN_EMAIL", "admin@movy.local");
  const adminPassword = readSeedValue("MOVY_DEMO_ADMIN_PASSWORD", "admin123");
  const passengerEmail = readSeedValue("MOVY_DEMO_PASSENGER_EMAIL", "ana@movy.local");
  const passengerPassword = readSeedValue("MOVY_DEMO_PASSENGER_PASSWORD", "123456");
  const driverEmail = readSeedValue("MOVY_DEMO_DRIVER_EMAIL", "carlos@movy.local");
  const driverPassword = readSeedValue("MOVY_DEMO_DRIVER_PASSWORD", "123456");
  const adminMfaEnabled = readSeedBoolean("MOVY_DEMO_ADMIN_MFA_ENABLED", true);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      mfaEnabled: adminMfaEnabled
    },
    create: {
      name: "Equipe MOVY",
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: UserRole.ADMIN,
      rating: 5,
      walletBalance: 0,
      mfaEnabled: adminMfaEnabled,
      wallet: {
        create: {
          balance: 0
        }
      }
    }
  });
  await ensureWallet(admin.id, 0);

  const passenger = await prisma.user.upsert({
    where: { email: passengerEmail },
    update: {},
    create: {
      name: "Ana Passageira",
      email: passengerEmail,
      passwordHash: hashPassword(passengerPassword),
      role: UserRole.PASSENGER,
      rating: 4.8,
      walletBalance: 150,
      wallet: {
        create: {
          balance: 150
        }
      }
    }
  });
  await ensureWallet(passenger.id, 150);

  const carlos = await prisma.user.upsert({
    where: { email: driverEmail },
    update: {},
    create: {
      name: "Carlos Motorista",
      email: driverEmail,
      passwordHash: hashPassword(driverPassword),
      role: UserRole.DRIVER,
      rating: 4.8,
      walletBalance: 0,
      wallet: {
        create: {
          balance: 0
        }
      }
    }
  });
  await ensureWallet(carlos.id, 0);

  const fernanda = await prisma.user.upsert({
    where: { email: "fernanda@movy.local" },
    update: {},
    create: {
      name: "Fernanda Prime",
      email: "fernanda@movy.local",
      passwordHash: hashPassword("123456"),
      role: UserRole.DRIVER,
      rating: 4.9,
      walletBalance: 0,
      wallet: {
        create: {
          balance: 0
        }
      }
    }
  });
  await ensureWallet(fernanda.id, 0);

  await prisma.driverProfile.upsert({
    where: { userId: carlos.id },
    update: {},
    create: {
      userId: carlos.id,
      businessName: "Carlos Executivo",
      basePricePerKm: 3.5,
      coverageRadiusKm: 18,
      vehicleType: "Sedan",
      serviceTypes: [RideType.INSTANT, RideType.SCHEDULED],
      currentAddress: "Av. Paulista, Sao Paulo",
      currentLat: -23.561684,
      currentLng: -46.655981,
      safetyScore: 96,
      kycStatus: "VERIFIED",
      available: true
    }
  });

  const carlosDriver = await prisma.driverProfile.findUniqueOrThrow({
    where: { userId: carlos.id }
  });

  await prisma.vehicle.upsert({
    where: { plate: "MOV1234" },
    update: {},
    create: {
      driverId: carlosDriver.id,
      make: "Toyota",
      model: "Corolla",
      color: "Prata",
      plate: "MOV1234",
      year: 2021,
      verified: true
    }
  });

  await prisma.driverProfile.upsert({
    where: { userId: fernanda.id },
    update: {},
    create: {
      userId: fernanda.id,
      businessName: "Fernanda Select",
      basePricePerKm: 4.2,
      coverageRadiusKm: 24,
      vehicleType: "SUV",
      serviceTypes: [RideType.INSTANT, RideType.SCHEDULED, RideType.SHARED],
      currentAddress: "Ibirapuera, Sao Paulo",
      currentLat: -23.587416,
      currentLng: -46.657634,
      safetyScore: 99,
      kycStatus: "VERIFIED",
      available: true
    }
  });

  await ensureNotification(admin.id, "Painel ativo", "Monitoramento operacional inicializado.", "INFO");
  await ensureNotification(passenger.id, "Bem-vinda a MOVY", "Seu perfil esta pronto para solicitar viagens.", "INFO");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
