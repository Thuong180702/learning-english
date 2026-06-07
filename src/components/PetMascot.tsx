"use client";

import Image from "next/image";

export function PetMascot() {
  return (
    <div className="fixed -bottom-6 right-6 z-50 animate-bounce-slow pointer-events-none">
      <div className="relative w-48 h-48 cursor-pointer transition-transform hover:scale-110 group pointer-events-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-300 to-lime-300 rounded-full opacity-15 blur-3xl group-hover:opacity-25 transition-opacity scale-125" />
        <Image
          src="/image/logo.png"
          alt="LearnEnglish Logo"
          fill
          className="object-contain drop-shadow-2xl"
          priority
        />
      </div>
    </div>
  );
}
