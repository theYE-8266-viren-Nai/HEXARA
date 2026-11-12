import { createContext, useContext } from "react";
import type { DeviceStatus } from "./useDeviceStream";
import type { MetricCardData } from "../types/horizon";

export interface DeviceContextValue { status: DeviceStatus; metrics: MetricCardData[]; }
export const DeviceContext = createContext<DeviceContextValue | null>(null);
export const useDevice = () => useContext(DeviceContext);
