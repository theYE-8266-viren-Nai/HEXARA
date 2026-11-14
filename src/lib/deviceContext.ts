import { createContext, useContext } from "react";
import type { DeviceStatus } from "./useDeviceStream";
import type { IngestSummary } from "../domain/ingest";
import type { MetricCardData } from "../types/horizon";
import type { BluetoothHeartRate } from "./useBluetoothHeartRate";
import type { WebhookSource } from "./useWebhookSource";
import type { BodyDeviceId } from "../domain/bodyDevices";
import type { MotionReadings } from "../domain/motionSensor";

/** Wearables paired for the 3D body overview during this visit. */
export interface BodyDeviceControls { bluetoothOn: boolean; listOpen: boolean; setBluetooth: (on: boolean) => void; setListOpen: (open: boolean) => void; paired: ReadonlySet<BodyDeviceId>; pairing: BodyDeviceId | null; pair: (id: BodyDeviceId) => void; unpair: (id: BodyDeviceId) => void; motion: MotionReadings }

export interface DeviceContextValue { bodyDevices?: BodyDeviceControls; status: DeviceStatus; metrics: MetricCardData[]; ingest: IngestSummary | null; /** Where the current alert decision comes from: the device's own readings, or the demo scenario. */ alertBasis?: "device" | "scenario" | "webhook"; /** Bluetooth heart-rate source state, when the app provides it. */ bluetooth?: Pick<BluetoothHeartRate, "phase" | "message" | "deviceName" | "ready" | "connect" | "disconnect">; /** Local webhook source state, when the app provides it. */ webhook?: Pick<WebhookSource, "phase" | "message" | "token" | "retentionHours" | "received" | "ready" | "start" | "stop">; }
export const DeviceContext = createContext<DeviceContextValue | null>(null);
export const useDevice = () => useContext(DeviceContext);
