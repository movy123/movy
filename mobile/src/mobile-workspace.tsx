import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { bookMobileRide, createMobileEstimate, loadDriverSnapshot, runDriverAction } from "./lib/movy-api";
import type { MobileDriverSnapshot, MobileEstimate, MobileRide } from "./types";

type Mode = "passageiro" | "motorista";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);

const formatStatus = (status: string) =>
  ({
    REQUESTED: "Solicitada",
    MATCHED: "Em matching",
    ACCEPTED: "Aceita",
    CHECKED_IN: "Check-in",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluida",
    CANCELLED: "Cancelada"
  })[status] ?? status;

export function MobileWorkspace() {
  const [mode, setMode] = useState<Mode>("passageiro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MobileEstimate | null>(null);
  const [ride, setRide] = useState<MobileRide | null>(null);
  const [driverSnapshot, setDriverSnapshot] = useState<MobileDriverSnapshot | null>(null);

  useEffect(() => {
    void refreshDriver();
  }, []);

  async function refreshDriver() {
    try {
      const snapshot = await loadDriverSnapshot();
      setDriverSnapshot(snapshot);
    } catch {
      setDriverSnapshot(null);
    }
  }

  async function handleEstimate() {
    setLoading(true);
    setError(null);
    try {
      const nextEstimate = await createMobileEstimate();
      setEstimate(nextEstimate);
      setRide(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel estimar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBookRide() {
    if (!estimate) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const booked = await bookMobileRide(estimate.id);
      setRide(booked.ride);
      await refreshDriver();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel reservar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDriverAction(action: "prepare" | "accept" | "start" | "complete") {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await runDriverAction(action, driverSnapshot?.ride?.id);
      setDriverSnapshot(snapshot);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha na operacao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>MOVY mobile workspace</Text>
        <Text style={styles.title}>Passageiro, motorista e operacao no mesmo app de campo.</Text>
        <Text style={styles.subtitle}>
          O app agora executa fluxos reais da MOVY em vez de apenas apresentar a proposta.
        </Text>

        <View style={styles.switchRow}>
          <Pressable
            style={[styles.switchButton, mode === "passageiro" && styles.switchActive]}
            onPress={() => setMode("passageiro")}
          >
            <Text style={styles.switchLabel}>Passageiro</Text>
          </Pressable>
          <Pressable
            style={[styles.switchButton, mode === "motorista" && styles.switchActive]}
            onPress={() => setMode("motorista")}
          >
            <Text style={styles.switchLabel}>Motorista</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color="#3dd9b8" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {mode === "passageiro" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estimativa conectada</Text>
              <Text style={styles.item}>Origem: Av. Paulista, Bela Vista</Text>
              <Text style={styles.item}>Destino: Pinheiros, Sao Paulo</Text>
              <View style={styles.actions}>
                <Pressable style={[styles.action, styles.primary]} onPress={handleEstimate}>
                  <Text style={styles.actionText}>Gerar estimativa</Text>
                </Pressable>
                <Pressable
                  style={[styles.action, !estimate && styles.actionDisabled]}
                  onPress={handleBookRide}
                  disabled={!estimate}
                >
                  <Text style={styles.actionText}>Reservar corrida</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resposta do estimate</Text>
              <Text style={styles.item}>
                Preco: {estimate ? formatCurrency(estimate.suggestedPrice) : "--"}
              </Text>
              <Text style={styles.item}>Faixa: {estimate ? `${formatCurrency(estimate.minPrice)} a ${formatCurrency(estimate.maxPrice)}` : "--"}</Text>
              <Text style={styles.item}>ETA: {estimate ? `${estimate.estimatedMinutes} min` : "--"}</Text>
              <Text style={styles.item}>Risco: {estimate?.riskLevel ?? "--"}</Text>
              <Text style={styles.item}>PIN obrigatorio: {estimate ? (estimate.pinRequired ? "Sim" : "Nao") : "--"}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Corrida reservada</Text>
              <Text style={styles.item}>Ride: {ride ? ride.id.slice(0, 8) : "--"}</Text>
              <Text style={styles.item}>Status: {ride ? formatStatus(ride.status) : "--"}</Text>
              <Text style={styles.item}>Preco sugerido: {ride ? formatCurrency(ride.suggestedPrice) : "--"}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cockpit do motorista</Text>
              <Text style={styles.item}>
                Perfil: {driverSnapshot ? `${driverSnapshot.driver.userName} | ${driverSnapshot.driver.businessName}` : "--"}
              </Text>
              <Text style={styles.item}>
                Carteira: {driverSnapshot ? formatCurrency(driverSnapshot.wallet.balance) : "--"}
              </Text>
              <Text style={styles.item}>
                Score de seguranca: {driverSnapshot ? driverSnapshot.driver.safetyScore : "--"}
              </Text>
              <View style={styles.actions}>
                <Pressable style={[styles.action, styles.primary]} onPress={() => handleDriverAction("prepare")}>
                  <Text style={styles.actionText}>Preparar demo</Text>
                </Pressable>
                <Pressable style={[styles.action, !driverSnapshot?.ride && styles.actionDisabled]} onPress={() => handleDriverAction("accept")} disabled={!driverSnapshot?.ride}>
                  <Text style={styles.actionText}>Aceitar</Text>
                </Pressable>
                <Pressable style={[styles.action, !driverSnapshot?.ride && styles.actionDisabled]} onPress={() => handleDriverAction("start")} disabled={!driverSnapshot?.ride}>
                  <Text style={styles.actionText}>Iniciar</Text>
                </Pressable>
                <Pressable style={[styles.action, !driverSnapshot?.ride && styles.actionDisabled]} onPress={() => handleDriverAction("complete")} disabled={!driverSnapshot?.ride}>
                  <Text style={styles.actionText}>Concluir</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Viagem ativa</Text>
              <Text style={styles.item}>Ride: {driverSnapshot?.ride ? driverSnapshot.ride.id.slice(0, 8) : "--"}</Text>
              <Text style={styles.item}>Status: {driverSnapshot?.ride ? formatStatus(driverSnapshot.ride.status) : "--"}</Text>
              <Text style={styles.item}>Origem: {driverSnapshot?.ride?.origin.address ?? "--"}</Text>
              <Text style={styles.item}>Destino: {driverSnapshot?.ride?.destination.address ?? "--"}</Text>
              <Text style={styles.item}>PIN: {driverSnapshot?.ride?.boardingPin ?? "--"}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#09131f"
  },
  container: {
    padding: 24,
    gap: 18
  },
  badge: {
    color: "#3dd9b8",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1.5
  },
  title: {
    color: "#f2f8ff",
    fontSize: 32,
    fontWeight: "700"
  },
  subtitle: {
    color: "#9cb7d1",
    fontSize: 16,
    lineHeight: 24
  },
  switchRow: {
    flexDirection: "row",
    gap: 12
  },
  switchButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#29435b",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#10263d"
  },
  switchActive: {
    borderColor: "#3dd9b8",
    backgroundColor: "#12374d"
  },
  switchLabel: {
    color: "#f2f8ff",
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#10263d",
    borderRadius: 20,
    padding: 20,
    gap: 10
  },
  cardTitle: {
    color: "#f4b740",
    fontSize: 20,
    fontWeight: "700"
  },
  item: {
    color: "#eaf4ff",
    fontSize: 15,
    lineHeight: 22
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8
  },
  action: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#173047"
  },
  primary: {
    backgroundColor: "#1d5d53"
  },
  actionDisabled: {
    opacity: 0.45
  },
  actionText: {
    color: "#f2f8ff",
    fontWeight: "600"
  },
  error: {
    color: "#ff8d8d",
    fontSize: 15
  }
});
