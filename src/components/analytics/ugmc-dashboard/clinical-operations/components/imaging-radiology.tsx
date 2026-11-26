"use client";

import * as React from "react";
import { type CallMetricsSlice } from "./call-metrics-helpers";
import CallOutcomeBarChart from "./call-outcome-bar-chart";

const infoText =
    "Outbound calls we placed, by initiating role — answered vs unanswered sessions.";

interface OutboundCallsByRoleProps {
    callMetrics?: CallMetricsSlice;
}

const OutboundCallsByRole: React.FC<OutboundCallsByRoleProps> = ({ callMetrics }) => (
    <CallOutcomeBarChart
        callMetrics={callMetrics}
        direction="outbound"
        dimension="role"
        title="Outbound Calls by Role"
        infoText={infoText}
        limit={4}
        showLiveBadge
    />
);

export default OutboundCallsByRole;
