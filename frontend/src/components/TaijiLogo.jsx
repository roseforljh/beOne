import { motion } from 'framer-motion';

export default function TaijiLogo({ size = 100, animate = true, className = '' }) {
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { duration: 8, repeat: Infinity, ease: "linear" } : {}}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <clipPath id="circle-clip">
            <circle cx="50" cy="50" r="48" />
          </clipPath>
        </defs>
        
        {/* 白色背景 */}
        <circle cx="50" cy="50" r="48" fill="#fff" />
        
        {/* 黑色半圆（左侧）+ 下方小半圆 */}
        <g clipPath="url(#circle-clip)">
          <path d="M 50 2 A 48 48 0 0 1 50 98 A 24 24 0 0 1 50 50 A 24 24 0 0 0 50 2 Z" fill="#000" />
        </g>
        
        {/* 外圆边框 */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="#000" strokeWidth="2" />
        
        {/* 白色小圆（阳眼，在黑色区域中） */}
        <circle cx="50" cy="75" r="8" fill="#fff" />
        
        {/* 黑色小圆（阴眼，在白色区域中） */}
        <circle cx="50" cy="25" r="8" fill="#000" />
      </svg>
    </motion.div>
  );
}
