import { createContext, useContext } from "react";
import type { DeviceStatus } from "./useDeviceStream";
import type { IngestSummary } from "../domain/ingest";
import type { MetricCardData } from "../types/horizon";
import type { BluetoothHeartRate } from "./useBluetoothHeartRate";

export interface DeviceContextValue { status: DeviceStatus; metrics: MetricCardData[]; ingest: IngestSummary | null; /** Where the current alert decision comes from: the device's own readings, or the demo scenario. */ alertBasis?: "device" | "scenario"; /** Bluetooth heart-rate source state, when the app provides it. */ bluetooth?: Pick<BluetoothHeartRate, "phase" | "message" | "deviceName" | "ready" | "connect" | "disconnect">; }
export const DeviceContext = createContext<DeviceContextValue | null>(null);
export const useDevice = () => useContext(DeviceContext);
