"use client";
import React, { useEffect, useRef, useState } from "react";
import anime from "animejs";
import { cn } from "@/lib/utils";
import { useIntersection } from "react-use";

export function LampDemo() {
  const contentRef = useRef<HTMLHeadingElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const intersection = useIntersection(contentRef as React.RefObject<HTMLElement>, {
    root: null,
    rootMargin: "0px",
    threshold: 0.1,
  });

  useEffect(() => {
    if (intersection?.isIntersecting && !hasAnimated) {
      setHasAnimated(true);
      anime({
        targets: contentRef.current,
        opacity: [0.5, 1],
        translateY: [100, 0],
        delay: 300,
        duration: 800,
        easing: "easeInOutQuad",
      });
    }
  }, [intersection, hasAnimated]);

  return (
    <LampContainer>
      <h1
        ref={contentRef}
        style={{ opacity: 0.5, transform: "translateY(100px)" }}
        className="mt-8 bg-gradient-to-br from-slate-300 to-slate-500 py-4 bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl"
      >
        Welcome to PIGEON <br /> The Next-Gen SMS Web3 Gateway
      </h1>
      <p className="mt-4 max-w-lg text-center text-slate-400 text-lg">
        Send crypto, manage accounts, and execute blockchain payments offline via simple SMS commands.
      </p>
    </LampContainer>
  );
}

export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Elements to animate
  const lampLeftRef = useRef<HTMLDivElement>(null);
  const lampRightRef = useRef<HTMLDivElement>(null);
  const lampGlow1Ref = useRef<HTMLDivElement>(null);
  const lampGlow2Ref = useRef<HTMLDivElement>(null);

  const intersection = useIntersection(containerRef as React.RefObject<HTMLElement>, {
    root: null,
    rootMargin: "0px",
    threshold: 0.5,
  });

  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (intersection?.isIntersecting && !hasAnimated) {
      setHasAnimated(true);

      anime({
        targets: lampLeftRef.current,
        opacity: [0.5, 1],
        width: ["15rem", "30rem"],
        delay: 300,
        duration: 800,
        easing: "easeInOutQuad",
      });

      anime({
        targets: lampRightRef.current,
        opacity: [0.5, 1],
        width: ["15rem", "30rem"],
        delay: 300,
        duration: 800,
        easing: "easeInOutQuad",
      });

      anime({
        targets: lampGlow1Ref.current,
        width: ["8rem", "16rem"],
        delay: 300,
        duration: 800,
        easing: "easeInOutQuad",
      });

      anime({
        targets: lampGlow2Ref.current,
        width: ["15rem", "30rem"],
        delay: 300,
        duration: 800,
        easing: "easeInOutQuad",
      });
    }
  }, [intersection, hasAnimated]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden bg-slate-950 w-full rounded-md z-0",
        className
      )}
    >
      <div className="relative flex w-full flex-1 scale-y-125 items-center justify-center isolate z-0 ">
        <div
          ref={lampLeftRef}
          style={{
            backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`,
            width: "15rem",
            opacity: 0.5,
          }}
          className="absolute inset-auto right-1/2 h-56 overflow-visible w-[30rem] bg-gradient-conic from-cyan-500 via-transparent to-transparent text-white [--conic-position:from_70deg_at_center_top]"
        >
          <div className="absolute  w-[100%] left-0 bg-slate-950 h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
          <div className="absolute  w-40 h-[100%] left-0 bg-slate-950  bottom-0 z-20 [mask-image:linear-gradient(to_right,white,transparent)]" />
        </div>
        <div
          ref={lampRightRef}
          style={{
            backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`,
            width: "15rem",
            opacity: 0.5,
          }}
          className="absolute inset-auto left-1/2 h-56 w-[30rem] bg-gradient-conic from-transparent via-transparent to-cyan-500 text-white [--conic-position:from_290deg_at_center_top]"
        >
          <div className="absolute  w-40 h-[100%] right-0 bg-slate-950  bottom-0 z-20 [mask-image:linear-gradient(to_left,white,transparent)]" />
          <div className="absolute  w-[100%] right-0 bg-slate-950 h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
        </div>
        <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-slate-950 blur-2xl"></div>
        <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md"></div>
        <div className="absolute inset-auto z-50 h-36 w-[28rem] -translate-y-1/2 rounded-full bg-cyan-500 opacity-50 blur-3xl"></div>
        <div
          ref={lampGlow1Ref}
          style={{ width: "8rem" }}
          className="absolute inset-auto z-30 h-36 w-64 -translate-y-[6rem] rounded-full bg-cyan-400 blur-2xl"
        ></div>
        <div
          ref={lampGlow2Ref}
          style={{ width: "15rem" }}
          className="absolute inset-auto z-50 h-0.5 w-[30rem] -translate-y-[7rem] bg-cyan-400 "
        ></div>

        <div className="absolute inset-auto z-40 h-44 w-full -translate-y-[12.5rem] bg-slate-950 "></div>
      </div>

      <div className="relative z-50 flex -translate-y-80 flex-col items-center px-5">
        {children}
      </div>
    </div>
  );
};
