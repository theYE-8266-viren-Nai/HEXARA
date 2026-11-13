import { createContext, useContext } from "react";
import type { DeviceStatus } from "./useDeviceStream";
import type { IngestSummary } from "../domain/ingest";
import type { MetricCardData } from "../types/horizon";
import type { BluetoothHeartRate } from "./useBluetoothHeartRate";
import type { WebhookSource } from "./useWebhookSource";

export interface DeviceContextValue { status: DeviceStatus; metrics: MetricCardData[]; ingest: IngestSummary | null; /** Where the current alert decision comes from: the device's own readings, or the demo scenario. */ alertBasis?: "device" | "scenario" | "webhook"; /** Bluetooth heart-rate source state, when the app provides it. */ bluetooth?: Pick<BluetoothHeartRate, "phase" | "message" | "deviceName" | "ready" | "connect" | "disconnect">; /** Local webhook source state, when the app provides it. */ webhook?: Pick<WebhookSource, "phase" | "message" | "token" | "retentionHours" | "received" | "ready" | "start" | "stop">; }
export const DeviceContext = createContext<DeviceContextValue | null>(null);
export const useDevice = () => useContext(DeviceContext);
