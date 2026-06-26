"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import { IoChevronDown } from "react-icons/io5";

type Patient = {
    name: string;
    age: number;
    gender: "M" | "F";
    acuity: 1 | 2 | 3 | 4 | 5;
    chiefComplaint: string;
    arrival: string;
    waitTime: string;
    waitTimeHighlight?: boolean;
    clinician: string | null;
    status: "Admission Pending" | "Discharge Pending" | "In Treatment" | "Waiting";
    edLOS: string;
};

const patients: Patient[] = [
    {
        name: "Akosua Kumi",
        age: 25,
        gender: "F",
        acuity: 1,
        chiefComplaint: "Cardiac symptoms",
        arrival: "12:45",
        waitTime: "2m",
        clinician: "Dr. Alissa Serwaa",
        status: "Admission Pending",
        edLOS: "45m",
    },
    {
        name: "Yaw Kwarteng",
        age: 55,
        gender: "M",
        acuity: 2,
        chiefComplaint: "Head injury",
        arrival: "13:20",
        waitTime: "5m",
        clinician: "Dr. Akosua Mensah",
        status: "Discharge Pending",
        edLOS: "45m",
    },
    {
        name: "Kofi Mensah",
        age: 67,
        gender: "M",
        acuity: 3,
        chiefComplaint: "Back pain",
        arrival: "14:00",
        waitTime: "55m",
        waitTimeHighlight: true,
        clinician: "Dr. Kwame Ansah",
        status: "In Treatment",
        edLOS: "45m",
    },
    {
        name: "Abena Darko",
        age: 41,
        gender: "F",
        acuity: 4,
        chiefComplaint: "Fever & cough",
        arrival: "14:15",
        waitTime: "15m",
        clinician: null,
        status: "Waiting",
        edLOS: "45m",
    },
    {
        name: "Ama Owusu",
        age: 25,
        gender: "F",
        acuity: 5,
        chiefComplaint: "Minor laceration",
        arrival: "14:25",
        waitTime: "34m",
        waitTimeHighlight: true,
        clinician: "Dr. Alissa Serwaa",
        status: "Discharge Pending",
        edLOS: "45m",
    },
];

const acuityColors: Record<number, string> = {
    1: "var(--accent-red)",
    2: "var(--accent-orange)",
    3: "var(--accent-orange)",
    4: "var(--accent-green)",
    5: "var(--accent-primary)",
};

const statusStyles: Record<string, { bg: string; text: string }> = {
    "Admission Pending": { bg: "var(--accent-violet)", text: "#FFFFFF" },
    "Discharge Pending": { bg: "var(--accent-green)", text: "#FFFFFF" },
    "In Treatment": { bg: "var(--accent-primary)", text: "#FFFFFF" },
    "Waiting": { bg: "var(--accent-orange)", text: "#FFFFFF" },
};

// Custom icons
const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.50047 0.9375C9.24108 0.9375 10.9104 1.62895 12.1412 2.85975C13.372 4.09054 14.0634 5.75986 14.0634 7.50047C14.0634 9.24108 13.372 10.9104 12.1412 12.1412C10.9104 13.372 9.24108 14.0634 7.50047 14.0634C5.75986 14.0634 4.09054 13.372 2.85975 12.1412C1.62895 10.9104 0.9375 9.24108 0.9375 7.50047C0.9375 5.75986 1.62895 4.09054 2.85975 2.85975C4.09054 1.62895 5.75986 0.9375 7.50047 0.9375ZM8.48484 4.96688C8.97234 4.96688 9.36797 4.62844 9.36797 4.12687C9.36797 3.62531 8.97141 3.28688 8.48484 3.28688C7.99734 3.28688 7.60359 3.62531 7.60359 4.12687C7.60359 4.62844 7.99734 4.96688 8.48484 4.96688ZM8.65641 10.2422C8.65641 10.1419 8.69109 9.88125 8.67141 9.73312L7.90078 10.62C7.74141 10.7878 7.54172 10.9041 7.44797 10.8731C7.40543 10.8575 7.36988 10.8272 7.34771 10.7876C7.32554 10.7481 7.31821 10.702 7.32703 10.6575L8.61141 6.6C8.71641 6.08531 8.42766 5.61562 7.81547 5.55562C7.16953 5.55562 6.21891 6.21094 5.64047 7.0425C5.64047 7.14188 5.62172 7.38937 5.64141 7.5375L6.41109 6.64969C6.57047 6.48375 6.75609 6.36656 6.84984 6.39844C6.89603 6.41502 6.93388 6.44904 6.95526 6.49321C6.97665 6.53738 6.97986 6.58817 6.96422 6.63469L5.69109 10.6725C5.54391 11.145 5.82234 11.6081 6.49734 11.7131C7.49109 11.7131 8.07797 11.0738 8.65734 10.2422H8.65641Z" fill="var(--text-tertiary)" />
    </svg>
);

const HeartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M6.24258 12.827L1.30156 8.21409C1.18672 8.10745 1.07734 7.9926 0.976172 7.87502H3.35508C3.97305 7.87502 4.53086 7.50315 4.76875 6.93166L5.05586 6.2426L6.40391 9.23674C6.50781 9.46916 6.73477 9.61956 6.98906 9.62229C7.24336 9.62502 7.47578 9.48557 7.59063 9.25862L8.75 6.93713L8.79648 7.0301C9.05625 7.54963 9.58672 7.87776 10.1664 7.87776H13.0238C12.9227 7.99534 12.8133 8.11018 12.6984 8.21682L7.75742 12.827C7.55234 13.0184 7.28164 13.125 7 13.125C6.71836 13.125 6.44766 13.0184 6.24258 12.827ZM13.773 6.56252H10.1637C10.0816 6.56252 10.0051 6.51604 9.9668 6.44221L9.33242 5.1762C9.22031 4.95471 8.99336 4.81252 8.74453 4.81252C8.4957 4.81252 8.26875 4.95198 8.15664 5.1762L7.02461 7.44026L5.63008 4.32581C5.52344 4.08791 5.28281 3.93479 5.02305 3.94026C4.76328 3.94573 4.52812 4.10159 4.42695 4.34495L3.55742 6.43127C3.52461 6.51331 3.44258 6.56526 3.35508 6.56526L0.4375 6.56252C0.366406 6.56252 0.300781 6.57346 0.237891 6.5926C0.0820312 6.15784 0 5.69299 0 5.21995V5.06135C0 3.15002 1.38086 1.52034 3.26484 1.20588C4.51172 0.998071 5.78047 1.40549 6.67188 2.2969L7 2.62502L7.32812 2.2969C8.21953 1.40549 9.48828 0.998071 10.7352 1.20588C12.6191 1.52034 14 3.15002 14 5.06135V5.21995C14 5.68206 13.9234 6.13596 13.773 6.56252Z" fill="var(--text-tertiary)" />
    </svg>
);

const StethoscopeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8.99967 14.6667C7.79967 14.6667 6.77745 14.2445 5.93301 13.4C5.08856 12.5556 4.66634 11.5334 4.66634 10.3334V9.95004C3.71079 9.79449 2.91634 9.34715 2.28301 8.60804C1.64967 7.86893 1.33301 6.9996 1.33301 6.00004V2.00004H3.33301V1.33337H4.66634V4.00004H3.33301V3.33337H2.66634V6.00004C2.66634 6.73337 2.92745 7.36115 3.44967 7.88337C3.9719 8.4056 4.59967 8.66671 5.33301 8.66671C6.06634 8.66671 6.69412 8.4056 7.21634 7.88337C7.73856 7.36115 7.99967 6.73337 7.99967 6.00004V3.33337H7.33301V4.00004H5.99967V1.33337H7.33301V2.00004H9.33301V6.00004C9.33301 7.00004 9.01634 7.8696 8.38301 8.60871C7.74967 9.34782 6.95523 9.79493 5.99967 9.95004V10.3334C5.99967 11.1667 6.29145 11.8752 6.87501 12.4587C7.45856 13.0423 8.16679 13.3338 8.99967 13.3334C9.83256 13.3329 10.541 13.0414 11.125 12.4587C11.709 11.876 12.0006 11.1676 11.9997 10.3334V9.21671C11.6108 9.08337 11.2915 8.84448 11.0417 8.50004C10.7919 8.1556 10.6668 7.76671 10.6663 7.33337C10.6663 6.77782 10.8608 6.3056 11.2497 5.91671C11.6386 5.52782 12.1108 5.33337 12.6663 5.33337C13.2219 5.33337 13.6941 5.52782 14.083 5.91671C14.4719 6.3056 14.6663 6.77782 14.6663 7.33337C14.6663 7.76671 14.5415 8.1556 14.2917 8.50004C14.0419 8.84448 13.7223 9.08337 13.333 9.21671V10.3334C13.333 11.5334 12.9108 12.5556 12.0663 13.4C11.2219 14.2445 10.1997 14.6667 8.99967 14.6667Z" fill="var(--text-primary)" />
    </svg>
);

const statusOptions = ["All Status", "Admission Pending", "Discharge Pending", "In Treatment", "Waiting"] as const;
const acuityOptions = ["All Acuities", "1", "2", "3", "4", "5"] as const;

const CurrentEDPatients: React.FC = () => {
    const [selectedStatus, setSelectedStatus] = useState<string>("All Status");
    const [selectedAcuity, setSelectedAcuity] = useState<string>("All Acuities");
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [acuityDropdownOpen, setAcuityDropdownOpen] = useState(false);

    const statusRef = useRef<HTMLDivElement>(null);
    const acuityRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setStatusDropdownOpen(false);
            }
            if (acuityRef.current && !acuityRef.current.contains(event.target as Node)) {
                setAcuityDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter patients based on selected filters
    const filteredPatients = patients.filter((patient) => {
        const statusMatch = selectedStatus === "All Status" || patient.status === selectedStatus;
        const acuityMatch = selectedAcuity === "All Acuities" || patient.acuity === parseInt(selectedAcuity);
        return statusMatch && acuityMatch;
    });

    return (
        <DashboardCard className="flex flex-col gap-4" padding="lg">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        Current ED Patients
                    </Text>
                    <Text variant="body-sm" color="text-tertiary">
                        Real-time patient information
                    </Text>
                </div>
                <div className="flex items-center gap-3">
                    {/* Status Filter Dropdown */}
                    <div className="relative" ref={statusRef}>
                        <button
                            className="flex items-center gap-2 bg-primary px-3 py-2 rounded-[8px] border border-tertiary shadow-sm hover:shadow transition-shadow"
                            onClick={() => {
                                setStatusDropdownOpen(!statusDropdownOpen);
                                setAcuityDropdownOpen(false);
                            }}
                        >
                            <InfoIcon />
                            <Text variant="body-sm" color="text-secondary">
                                {selectedStatus}
                            </Text>
                            <IoChevronDown
                                size={14}
                                className={`text-text-secondary transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`}
                            />
                        </button>
                        {statusDropdownOpen && (
                            <div className="absolute top-full mt-1 right-0 bg-primary rounded-[8px] border border-tertiary shadow-lg z-10 min-w-[160px] py-1">
                                {statusOptions.map((status) => (
                                    <button
                                        key={status}
                                        className={`w-full text-left px-3 py-2 hover:bg-secondary transition-colors ${selectedStatus === status ? "bg-secondary" : ""
                                            }`}
                                        onClick={() => {
                                            setSelectedStatus(status);
                                            setStatusDropdownOpen(false);
                                        }}
                                    >
                                        <Text
                                            variant="body-sm"
                                            color={selectedStatus === status ? "text-primary" : "text-secondary"}
                                        >
                                            {status}
                                        </Text>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Acuity Filter Dropdown */}
                    <div className="relative" ref={acuityRef}>
                        <button
                            className="flex items-center gap-2 bg-primary px-3 py-2 rounded-[8px] border border-tertiary shadow-sm hover:shadow transition-shadow"
                            onClick={() => {
                                setAcuityDropdownOpen(!acuityDropdownOpen);
                                setStatusDropdownOpen(false);
                            }}
                        >
                            <HeartIcon />
                            <Text variant="body-sm" color="text-secondary">
                                {selectedAcuity === "All Acuities" ? "All Acuities" : `Acuity ${selectedAcuity}`}
                            </Text>
                            <IoChevronDown
                                size={14}
                                className={`text-text-secondary transition-transform ${acuityDropdownOpen ? "rotate-180" : ""}`}
                            />
                        </button>
                        {acuityDropdownOpen && (
                            <div className="absolute top-full mt-1 right-0 bg-primary rounded-[8px] border border-tertiary shadow-lg z-10 min-w-[140px] py-1">
                                {acuityOptions.map((acuity) => (
                                    <button
                                        key={acuity}
                                        className={`w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex items-center gap-2 ${selectedAcuity === acuity ? "bg-secondary" : ""
                                            }`}
                                        onClick={() => {
                                            setSelectedAcuity(acuity);
                                            setAcuityDropdownOpen(false);
                                        }}
                                    >
                                        {acuity !== "All Acuities" && (
                                            <span
                                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                                style={{ backgroundColor: acuityColors[parseInt(acuity)] }}
                                            >
                                                {acuity}
                                            </span>
                                        )}
                                        <Text
                                            variant="body-sm"
                                            color={selectedAcuity === acuity ? "text-primary" : "text-secondary"}
                                        >
                                            {acuity === "All Acuities" ? acuity : `Level ${acuity}`}
                                        </Text>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border border-tertiary rounded-[10px]">
                <table className="w-full">
                    <thead>
                        <tr className="bg-secondary">
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Patient
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Acuity
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Chief Complaint
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Arrival
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Wait Time
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Clinician
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    Status
                                </Text>
                            </th>
                            <th className="text-left py-3 px-2">
                                <Text variant="body-md-semibold" color="text-primary">
                                    ED LOS
                                </Text>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.map((patient, index) => (
                            <tr
                                key={index}
                                className={`transition-colors ${index % 2 === 1 ? "bg-secondary" : "hover:bg-primary-light"
                                    }`}
                            >
                                <td className="py-3 px-2">
                                    <div className="flex flex-col">
                                        <Text variant="body-md-semibold" color="text-primary">
                                            {patient.name}
                                        </Text>
                                        <Text variant="body-md" color="text-secondary">
                                            {patient.age}, {patient.gender}
                                        </Text>
                                    </div>
                                </td>
                                <td className="py-3 px-2">
                                    <span
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                                        style={{ backgroundColor: acuityColors[patient.acuity] }}
                                    >
                                        {patient.acuity}
                                    </span>
                                </td>
                                <td className="py-3 px-2">
                                    <Text variant="body-md" color="text-primary">
                                        {patient.chiefComplaint}
                                    </Text>
                                </td>
                                <td className="py-3 px-2">
                                    <Text variant="body-md" color="text-primary">
                                        {patient.arrival}
                                    </Text>
                                </td>
                                <td className="py-3 px-2">
                                    <Text
                                        variant="body-md"
                                        color={patient.waitTimeHighlight ? "accent-red" : "text-primary"}
                                    >
                                        {patient.waitTime}
                                    </Text>
                                </td>
                                <td className="py-3 px-2">
                                    {patient.clinician ? (
                                        <div className="flex items-center gap-2">
                                            <StethoscopeIcon />
                                            <Text variant="body-md" color="text-primary">
                                                {patient.clinician}
                                            </Text>
                                        </div>
                                    ) : (
                                        <Text variant="body-md" color="text-secondary">
                                            Pending...
                                        </Text>
                                    )}
                                </td>
                                <td className="py-3 px-2">
                                    <span
                                        className="px-3 py-1.5 rounded-[6px] text-sm font-semibold whitespace-nowrap"
                                        style={{
                                            backgroundColor: statusStyles[patient.status].bg,
                                            color: statusStyles[patient.status].text,
                                        }}
                                    >
                                        {patient.status}
                                    </span>
                                </td>
                                <td className="py-3 px-2">
                                    <Text variant="body-md" color="text-primary">
                                        {patient.edLOS}
                                    </Text>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-tertiary">
                <Text variant="body-md" color="text-secondary">
                    Showing {filteredPatients.length} of {patients.length} patients
                </Text>
                <button className="text-accent-primary text-base font-semibold hover:underline flex items-center gap-1">
                    View All Patients <span>→</span>
                </button>
            </div>
        </DashboardCard>
    );
};

export default CurrentEDPatients;
