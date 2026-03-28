import { PrismaClient, UserRole, RideType } from "@prisma/client";
import { hashPassword } from "../src/shared/security.js";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@movy.local" },
    update: {
      mfaEnabled: true
    },
    create: {
      name: "Equipe MOVY",
      email: "admin@movy.local",
      passwordHash: hashPassword("admin123"),
      role: UserRole.ADMIN,
      rating: 5,
      walletBalance: 0,
      mfaEnabled: true,
      wallet: {
        create: {
          balance: 0
        }
      }
    }
  });

  const passenger = await prisma.user.upsert({
    where: { email: "ana@movy.local" },
    update: {},
    create: {
      name: "Ana Passageira",
      email: "ana@movy.local",
      passwordHash: hashPassword("123456"),
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

  const carlos = await prisma.user.upsert({
    where: { email: "carlos@movy.local" },
    update: {},
    create: {
      name: "Carlos Motorista",
      email: "carlos@movy.local",
      passwordHash: hashPassword("123456"),
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

  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: "Painel ativo",
        message: "Monitoramento operacional inicializado.",
        level: "INFO",
        channel: "IN_APP"
      },
      {
        userId: passenger.id,
        title: "Bem-vinda a MOVY",
        message: "Seu perfil esta pronto para solicitar viagens.",
        level: "INFO",
        channel: "IN_APP"
      }
    ],
    skipDuplicates: true
  });
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
