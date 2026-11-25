"use client";

import * as React from "react";
import { type CallMetricsSlice } from "./call-metrics-helpers";
import CallOutcomeBarChart from "./call-outcome-bar-chart";

const infoText =
    "Outbound calls we placed, by initiating department — answered vs unanswered sessions.";

interface OutboundCallsByDepartmentProps {
    callMetrics?: CallMetricsSlice;
}

const OutboundCallsByDepartment: React.FC<OutboundCallsByDepartmentProps> = ({ callMetrics }) => (
    <CallOutcomeBarChart
        callMetrics={callMetrics}
        direction="outbound"
        dimension="department"
        title="Outbound Calls by Department"
        infoText={infoText}
        limit={6}
    />
);

export default OutboundCallsByDepartment;
