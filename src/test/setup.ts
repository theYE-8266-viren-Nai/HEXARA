import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { deviceTiming } from "../lib/useDeviceStream";

// Fast, quiet simulated wearable in UI tests; tests that need ticks override these.
deviceTiming.connectMs = 30;
deviceTiming.tickMs = 1_000_000;

afterEach(() => cleanup());
