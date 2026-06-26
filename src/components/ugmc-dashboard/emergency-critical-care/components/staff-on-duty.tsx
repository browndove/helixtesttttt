"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import { IoSend, IoWarning, IoClose, IoCheckmarkCircle, IoVideocam, IoCall } from "react-icons/io5";
import { FaBell, FaUserMd, FaUsers, FaHospital } from "react-icons/fa";

type StaffStatus = "available" | "busy" | "on-break" | "in-surgery";
type AlertType = "code-blue" | "code-red" | "general" | "staff-call";

type StaffMember = {
    id: string;
    name: string;
    role: string;
    specialty?: string;
    avatar: string;
    status: StaffStatus;
    currentTask?: string;
};

const staffMembers: StaffMember[] = [
    {
        id: "1",
        name: "Dr. Akosua Mensah",
        role: "Senior Consultant",
        specialty: "Emergency Medicine",
        avatar: "/assets/images/image 2.png",
        status: "available",
    },
    {
        id: "2",
        name: "Dr. Kwame Ansah",
        role: "Attending Physician",
        specialty: "Trauma Surgery",
        avatar: "/assets/images/image 3.png",
        status: "busy",
    },
    {
        id: "3",
        name: "Dr. Alissa Serwaa",
        role: "Surgeon",
        avatar: "/assets/images/image 4.png",
        status: "in-surgery",
    },
    {
        id: "4",
        name: "Nurse Kofi Asante",
        role: "Consultant",
        specialty: "Cardiology",
        avatar: "/assets/images/image 5.png",
        status: "on-break",
    },
    {
        id: "5",
        name: "Nurse Ama Owusu",
        role: "Head Nurse",
        avatar: "/assets/images/image 6.png",
        status: "available",
    },
    {
        id: "6",
        name: "Nurse Kofi Asante",
        role: "ED Nurse",
        avatar: "/assets/images/image 7.png",
        status: "busy",
    },
];

const statusConfig: Record<StaffStatus, { color: string; bg: string; label: string }> = {
    available: { color: "#00C8B3", bg: "rgba(0, 200, 179, 0.1)", label: "Available" },
    busy: { color: "#E89B00", bg: "rgba(232, 155, 0, 0.1)", label: "Busy" },
    "on-break": { color: "#b4bfc8ff", bg: "rgba(163, 178, 190, 0.1)", label: "On Break" },
    "in-surgery": { color: "#FF5F57", bg: "rgba(255, 95, 87, 0.1)", label: "In Surgery" },
};

const alertTypes: { type: AlertType; label: string; color: string; icon: React.ReactNode }[] = [
    { type: "code-blue", label: "Code Blue", color: "#2980D3", icon: <FaUserMd size={14} /> },
    { type: "code-red", label: "Code Red", color: "#FF5F57", icon: <IoWarning size={14} /> },
    { type: "staff-call", label: "Staff Call", color: "#E89B00", icon: <FaUsers size={14} /> },
    { type: "general", label: "General", color: "#00C8B3", icon: <FaHospital size={14} /> },
];

const StatusIndicator = ({ status }: { status: StaffStatus }) => {
    const config = statusConfig[status];
    return (
        <div
            className="inline-flex items-center gap-1.5 rounded-full"
            style={{ backgroundColor: config.bg, padding: '3px 8px' }}
        >
            <span
                className="w-[6px] h-[6px] rounded-full"
                style={{ backgroundColor: config.color }}
            />
            <span className="text-[11px] font-medium" style={{ color: config.color }}>
                {config.label}
            </span>
        </div>
    );
};

const StaffCard = ({
    staff,
    onMessage,
    onClick
}: {
    staff: StaffMember;
    onMessage: (staff: StaffMember) => void;
    onClick: (staff: StaffMember) => void;
}) => {
    const statusColor = statusConfig[staff.status].color;

    return (
        <div
            className="relative flex items-center gap-3 rounded-[12px] bg-primary border border-tertiary hover:border-accent-primary/30 transition-all group cursor-pointer"
            style={{ padding: '8px 12px' }}
            onClick={() => onClick(staff)}
        >
            {/* Avatar with status ring and dot */}
            <div className="relative shrink-0">
                <div
                    className="w-[38px] h-[38px] rounded-full overflow-hidden border-2 flex items-center justify-center"
                    style={{
                        borderColor: statusColor,
                        mask: 'radial-gradient(circle at 85% 85%, transparent 8px, black 8px)',
                        WebkitMask: 'radial-gradient(circle at 85% 85%, transparent 8px, black 8px)'
                    }}
                >
                    <Image
                        src={staff.avatar}
                        alt={staff.name}
                        width={88}
                        height={88}
                        className="min-w-[125%] min-h-[120%] object-contain object-center scale-140"
                    />
                </div>
                {/* Status dot at 5 o'clock position */}
                <span
                    className="absolute w-[12px] h-[12px] rounded-full"
                    style={{
                        backgroundColor: statusColor,
                        bottom: '0px',
                        right: '0px'
                    }}
                />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <Text variant="body-sm" color="text-primary" className="block font-semibold leading-tight">
                    {staff.name}
                </Text>
                <Text variant="body-xs" color="text-secondary" className="block mt-0.5 leading-snug">
                    {staff.role}
                    {staff.specialty && ` - ${staff.specialty}`}
                </Text>
                <div>
                    <StatusIndicator status={staff.status} />
                </div>
            </div>

            {/* Message Button - appears on hover */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onMessage(staff);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex w-[28px] h-[28px] rounded-full bg-accent-primary items-center justify-center transition-all hover:scale-110 shadow-md shrink-0"
                title={`Message ${staff.name}`}
            >
                <IoSend size={14} className="text-white" />
            </button>
        </div>
    );
};

const StaffOnDuty: React.FC = () => {
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [showStaffDetail, setShowStaffDetail] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [selectedAlertType, setSelectedAlertType] = useState<AlertType | null>(null);
    const [message, setMessage] = useState("");
    const [alertSent, setAlertSent] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StaffStatus | "all">("all");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const availableCount = staffMembers.filter((s) => s.status === "available").length;
    const filteredStaff = statusFilter === "all"
        ? staffMembers
        : staffMembers.filter((s) => s.status === statusFilter);

    const handleOpenMessage = (staff: StaffMember) => {
        setSelectedStaff(staff);
        setShowStaffDetail(false);
        setShowMessageModal(true);
    };

    const handleOpenStaffDetail = (staff: StaffMember) => {
        setSelectedStaff(staff);
        setShowStaffDetail(true);
    };

    const handleSendMessage = () => {
        if (message.trim() && selectedStaff) {
            console.log(`Message sent to ${selectedStaff.name}:`, message);
            setMessageSent(true);
            setTimeout(() => {
                setMessage("");
                setMessageSent(false);
                setShowMessageModal(false);
                setSelectedStaff(null);
            }, 1500);
        }
    };

    const handleSendAlert = () => {
        if (selectedAlertType) {
            console.log("Alert sent:", selectedAlertType);
            setAlertSent(true);
            setTimeout(() => {
                setAlertSent(false);
                setShowAlertModal(false);
                setSelectedAlertType(null);
            }, 2000);
        }
    };

    return (
        <>
            <DashboardCard className="flex flex-col gap-4" padding="lg">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <Text variant="body-md-semibold" color="text-primary">
                            Staff On Duty
                        </Text>
                        <Text variant="body-sm" color="text-tertiary">
                            {staffMembers.length} Staff members - {availableCount} Available
                        </Text>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Alert Button */}
                        <button
                            onClick={() => setShowAlertModal(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-accent-red/10 hover:bg-accent-red/20 transition-colors"
                        >
                            <FaBell size={14} className="text-accent-red" />
                            <Text variant="body-sm-semibold" color="accent-red">
                                Broadcast Alert
                            </Text>
                        </button>
                        {/* Status Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as StaffStatus | "all")}
                                className="appearance-none pl-3 pr-8 py-2 rounded-[8px] bg-secondary border border-tertiary text-text-primary text-sm font-medium cursor-pointer focus:outline-none focus:border-accent-primary transition-colors"
                            >
                                <option value="all">All Status</option>
                                <option value="available">Available</option>
                                <option value="busy">Busy</option>
                                <option value="on-break">On Break</option>
                                <option value="in-surgery">In Surgery</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Staff Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {filteredStaff.map((staff) => (
                        <StaffCard
                            key={staff.id}
                            staff={staff}
                            onMessage={handleOpenMessage}
                            onClick={handleOpenStaffDetail}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-tertiary">
                    <div className="flex items-center gap-6">
                        {Object.entries(statusConfig).map(([status, config]) => (
                            <div key={status} className="flex items-center gap-2">
                                <span
                                    className="w-[8px] h-[8px] rounded-full"
                                    style={{ backgroundColor: config.color }}
                                />
                                <span className="text-[13px] text-text-secondary">
                                    {config.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <button className="text-accent-primary text-[13px] font-semibold hover:underline">
                        View All Staff +
                    </button>
                </div>
            </DashboardCard>

            {mounted && showMessageModal && selectedStaff && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            setShowMessageModal(false);
                            setSelectedStaff(null);
                            setMessage("");
                            setMessageSent(false);
                        }}
                    />
                    <div className="relative bg-primary rounded-[20px] shadow-2xl w-[95%] max-w-[450px] p-6 animate-scale-in">
                        <button
                            onClick={() => {
                                setShowMessageModal(false);
                                setSelectedStaff(null);
                                setMessage("");
                                setMessageSent(false);
                            }}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-tertiary transition-colors"
                        >
                            <IoClose size={18} className="text-text-secondary" />
                        </button>

                        {messageSent ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-accent-green/20 flex items-center justify-center mb-4 animate-pulse-custom">
                                    <IoCheckmarkCircle size={40} className="text-accent-green" />
                                </div>
                                <Text variant="body-lg" color="text-primary">
                                    Message Sent!
                                </Text>
                                <Text variant="body-sm" color="text-tertiary" className="mt-1">
                                    {selectedStaff.name} has been notified
                                </Text>
                            </div>
                        ) : (
                            <>
                                {/* Recipient Info */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="relative">
                                        <div
                                            className="w-14 h-14 rounded-full overflow-hidden border-2"
                                            style={{ borderColor: statusConfig[selectedStaff.status].color }}
                                        >
                                            <Image
                                                src={selectedStaff.avatar}
                                                alt={selectedStaff.name}
                                                width={56}
                                                height={56}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span
                                            className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-primary"
                                            style={{ backgroundColor: statusConfig[selectedStaff.status].color }}
                                        />
                                    </div>
                                    <div>
                                        <Text variant="body-lg" color="text-primary" className="block mb-1">
                                            Message {selectedStaff.name}
                                        </Text>
                                        <Text variant="body-sm" color="text-tertiary" className="block">
                                            {selectedStaff.role}
                                            {selectedStaff.specialty && ` • ${selectedStaff.specialty}`}
                                        </Text>
                                        <StatusIndicator status={selectedStaff.status} />
                                    </div>
                                </div>

                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder={`Type your message to ${selectedStaff.name.split(' ')[0]}...`}
                                    className="w-full h-32 p-4 rounded-[12px] bg-secondary border border-tertiary text-text-primary placeholder:text-text-tertiary text-sm resize-none focus:outline-none focus:border-accent-primary transition-colors"
                                    autoFocus
                                />

                                <div className="flex items-center justify-end gap-3 mt-4">
                                    <button
                                        onClick={() => {
                                            setShowMessageModal(false);
                                            setSelectedStaff(null);
                                            setMessage("");
                                        }}
                                        className="px-4 py-2 rounded-[8px] text-sm font-medium text-text-secondary hover:bg-secondary transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!message.trim()}
                                        className="px-6 py-2 rounded-[8px] bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                    >
                                        <IoSend size={14} />
                                        Send
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {mounted && showAlertModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            setShowAlertModal(false);
                            setSelectedAlertType(null);
                            setAlertSent(false);
                        }}
                    />
                    <div className="relative bg-primary rounded-[20px] shadow-2xl w-[95%] max-w-[450px] p-6 animate-scale-in">
                        <button
                            onClick={() => {
                                setShowAlertModal(false);
                                setSelectedAlertType(null);
                                setAlertSent(false);
                            }}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-tertiary transition-colors"
                        >
                            <IoClose size={18} className="text-text-secondary" />
                        </button>

                        {alertSent ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-accent-green/20 flex items-center justify-center mb-4 animate-pulse-custom">
                                    <IoCheckmarkCircle size={40} className="text-accent-green" />
                                </div>
                                <Text variant="body-lg" color="text-primary">
                                    Alert Sent Successfully
                                </Text>
                                <Text variant="body-sm" color="text-tertiary" className="mt-1">
                                    All relevant staff have been notified
                                </Text>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-accent-red/20 flex items-center justify-center">
                                        <FaBell size={20} className="text-accent-red" />
                                    </div>
                                    <div>
                                        <Text variant="body-lg" color="text-primary" className="block">
                                            Broadcast Alert
                                        </Text>
                                        <Text variant="body-sm" color="text-tertiary">
                                            Select alert type to notify all staff
                                        </Text>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {alertTypes.map((alert) => (
                                        <button
                                            key={alert.type}
                                            onClick={() => setSelectedAlertType(alert.type)}
                                            className={`flex items-center gap-3 p-4 rounded-[12px] border-2 transition-all ${selectedAlertType === alert.type
                                                ? "border-current shadow-lg"
                                                : "border-tertiary hover:border-current/30"
                                                }`}
                                            style={{
                                                borderColor:
                                                    selectedAlertType === alert.type
                                                        ? alert.color
                                                        : undefined,
                                                backgroundColor:
                                                    selectedAlertType === alert.type
                                                        ? `${alert.color}10`
                                                        : undefined,
                                            }}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                                style={{
                                                    backgroundColor: `${alert.color}20`,
                                                    color: alert.color,
                                                }}
                                            >
                                                {alert.icon}
                                            </div>
                                            <Text
                                                variant="body-sm-semibold"
                                                color="text-primary"
                                            >
                                                {alert.label}
                                            </Text>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => {
                                            setShowAlertModal(false);
                                            setSelectedAlertType(null);
                                        }}
                                        className="px-4 py-2 rounded-[8px] text-sm font-medium text-text-secondary hover:bg-secondary transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSendAlert}
                                        disabled={!selectedAlertType}
                                        className="px-6 py-2 rounded-[8px] bg-accent-red text-white text-sm font-semibold hover:bg-accent-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                    >
                                        <FaBell size={14} />
                                        Send Alert
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {mounted && showStaffDetail && selectedStaff && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            setShowStaffDetail(false);
                            setSelectedStaff(null);
                        }}
                    />
                    <div className="relative bg-primary rounded-[20px] shadow-2xl w-[95%] max-w-[400px] p-6 animate-scale-in">
                        <button
                            onClick={() => {
                                setShowStaffDetail(false);
                                setSelectedStaff(null);
                            }}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-tertiary transition-colors"
                        >
                            <IoClose size={18} className="text-text-secondary" />
                        </button>

                        {/* Staff Info */}
                        <div className="flex flex-col items-center text-center">
                            {/* Avatar */}
                            <div className="relative mb-4">
                                <div
                                    className="w-[80px] h-[80px] rounded-full overflow-hidden border-[3px] flex items-center justify-center"
                                    style={{
                                        borderColor: statusConfig[selectedStaff.status].color,
                                        mask: 'radial-gradient(circle at 85% 85%, transparent 10px, black 10px)',
                                        WebkitMask: 'radial-gradient(circle at 85% 85%, transparent 10px, black 10px)'
                                    }}
                                >
                                    <Image
                                        src={selectedStaff.avatar}
                                        alt={selectedStaff.name}
                                        width={160}
                                        height={160}
                                        className="min-w-[130%] min-h-[130%] object-cover"
                                    />
                                </div>
                                {/* Status dot */}
                                <span
                                    className="absolute w-[16px] h-[16px] rounded-full"
                                    style={{
                                        backgroundColor: statusConfig[selectedStaff.status].color,
                                        bottom: '2px',
                                        right: '2px'
                                    }}
                                />
                            </div>

                            <Text variant="body-lg" color="text-primary" className="font-semibold">
                                {selectedStaff.name}
                            </Text>
                            <Text variant="body-sm" color="text-secondary" className="mt-1">
                                {selectedStaff.role}
                                {selectedStaff.specialty && ` - ${selectedStaff.specialty}`}
                            </Text>
                            <div className="mt-2">
                                <StatusIndicator status={selectedStaff.status} />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <button
                                onClick={() => console.log('Video call:', selectedStaff.name)}
                                className="flex flex-col items-center gap-2 px-6 py-3 rounded-[12px] bg-accent-primary/10 hover:bg-accent-primary/20 transition-colors group"
                            >
                                <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <IoVideocam size={22} className="text-white" />
                                </div>
                                <Text variant="body-xs" color="text-primary" className="font-medium">
                                    Video Call
                                </Text>
                            </button>

                            <button
                                onClick={() => console.log('Voice call:', selectedStaff.name)}
                                className="flex flex-col items-center gap-2 px-6 py-3 rounded-[12px] bg-accent-green/10 hover:bg-accent-green/20 transition-colors group"
                            >
                                <div className="w-12 h-12 rounded-full bg-accent-green flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <IoCall size={22} className="text-white" />
                                </div>
                                <Text variant="body-xs" color="text-primary" className="font-medium">
                                    Voice Call
                                </Text>
                            </button>

                            <button
                                onClick={() => handleOpenMessage(selectedStaff)}
                                className="flex flex-col items-center gap-2 px-6 py-3 rounded-[12px] bg-secondary hover:bg-tertiary transition-colors group"
                            >
                                <div className="w-12 h-12 rounded-full bg-text-tertiary flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <IoSend size={20} className="text-white" />
                                </div>
                                <Text variant="body-xs" color="text-primary" className="font-medium">
                                    Message
                                </Text>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default StaffOnDuty;
