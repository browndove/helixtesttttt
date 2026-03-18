'use client';

import { motion } from 'framer-motion';

type Direction = 'top' | 'bottom' | 'left' | 'right';

const offsets: Record<Direction, { x?: number; y?: number }> = {
    top: { y: -24 },
    bottom: { y: 24 },
    left: { x: -24 },
    right: { x: 24 },
};

interface SlideInProps {
    children: React.ReactNode;
    direction?: Direction;
    className?: string;
}

export default function SlideIn({ children, direction = 'bottom', className }: SlideInProps) {
    const offset = offsets[direction];
    return (
        <motion.div
            initial={{
                opacity: 0,
                ...(offset.x !== undefined ? { x: offset.x } : {}),
                ...(offset.y !== undefined ? { y: offset.y } : {}),
            }}
            animate={{
                opacity: 1,
                x: 0,
                y: 0,
            }}
            transition={{
                type: 'spring',
                stiffness: 100,
                damping: 20,
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
