"use client";

import * as React from "react";
import { type CallMetricsSlice } from "./call-metrics-helpers";
import CallOutcomeBarChart from "./call-outcome-bar-chart";

const infoText =
    "Incoming calls we received, by signed-in recipient role — answered vs missed (per person).";

interface InboundCallsByRoleProps {
    callMetrics?: CallMetricsSlice;
}

const InboundCallsByRole: React.FC<InboundCallsByRoleProps> = ({ callMetrics }) => (
    <CallOutcomeBarChart
        callMetrics={callMetrics}
        direction="inbound"
        dimension="role"
        title="Incoming Calls by Role"
        infoText={infoText}
        limit={4}
    />
);

export default InboundCallsByRole;
