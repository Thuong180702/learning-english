"use client";

import Image from "next/image";

export function PetMascot() {
  return (
    <div className="fixed -bottom-6 right-6 z-50 animate-bounce-slow pointer-events-none">
      <div className="relative w-48 h-48 cursor-pointer transition-transform hover:scale-110 group pointer-events-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-400 rounded-full opacity-15 blur-3xl group-hover:opacity-25 transition-opacity scale-125" />
        <Image
          src="/image/pet.png"
          alt="Learning Pet"
          fill
          className="object-contain drop-shadow-2xl"
          priority
        />
      </div>
    </div>
  );
}
