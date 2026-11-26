"use client";

import * as React from "react";
import { type CallMetricsSlice } from "./call-metrics-helpers";
import CallOutcomeBarChart from "./call-outcome-bar-chart";

const infoText =
    "Incoming calls we received, by recipient department — answered vs missed (per person).";

interface InboundCallsByDepartmentProps {
    callMetrics?: CallMetricsSlice;
}

const InboundCallsByDepartment: React.FC<InboundCallsByDepartmentProps> = ({ callMetrics }) => (
    <CallOutcomeBarChart
        callMetrics={callMetrics}
        direction="inbound"
        dimension="department"
        title="Incoming Calls by Department"
        infoText={infoText}
        limit={6}
    />
);

export default InboundCallsByDepartment;
