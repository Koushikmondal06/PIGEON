import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const techStack = [
    { name: 'Node.js', color: '#339933' },
    { name: 'TypeScript', color: '#3178C6' },
    { name: 'Algorand', color: '#000000' },
    { name: 'AlgoKit', color: '#6E40C9' },
    { name: 'Gemini AI', color: '#8B5CF6' },
    { name: 'algosdk', color: '#28A0F0' },
    { name: 'Puya TS', color: '#10B981' },
    { name: 'Express', color: '#FF6600' },
]

export function Architecture() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (!sectionRef.current) return

        // Header — scrub
        gsap.fromTo(
            sectionRef.current.querySelector('.section-header'),
            { opacity: 0, y: 60 },
            {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 80%',
                    end: 'top 50%',
                    scrub: 1,
                },
            }
        )

        // Architecture diagram — 3D perspective reveal
        const diagramEl = sectionRef.current.querySelector('.arch-diagram')
        if (diagramEl) {
            gsap.fromTo(
                diagramEl,
                { opacity: 0, scale: 0.85, rotateX: 10 },
                {
                    opacity: 1,
                    scale: 1,
                    rotateX: 0,
                    duration: 1.2,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: diagramEl,
                        start: 'top 85%',
                        end: 'top 50%',
                        scrub: 1,
                    },
                }
            )
        }

        // Tech badges — staggered reveal
        const techStackEl = sectionRef.current.querySelector('.tech-stack')
        const badges = sectionRef.current.querySelectorAll('.tech-badge')
        badges.forEach((badge, i) => {
            gsap.fromTo(
                badge,
                { opacity: 0, y: 20, scale: 0.8 },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.5,
                    delay: i * 0.06,
                    ease: 'back.out(1.5)',
                    scrollTrigger: {
                        trigger: techStackEl,
                        start: 'top 85%',
                        end: 'top 65%',
                        scrub: 1,
                    },
                }
            )
        })
    }, [])

    return (
        <section id="architecture" ref={sectionRef} className="relative z-10 py-32 md:py-48 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="section-header flex flex-col items-center text-center mb-32">
                    <span className="inline-block px-4 py-1.5 text-xs tracking-[0.3em] uppercase font-mono text-[var(--accent)] mb-6">
                        [ Architecture ]
                    </span>
                    <h2 className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black uppercase tracking-[-0.05em] mb-8 leading-[0.9]">
                        System<br />
                        <span className="text-[var(--primary)]">Design</span>
                    </h2>
                    <p className="text-[var(--muted-foreground)] max-w-3xl text-base md:text-lg lg:text-xl leading-relaxed">
                        A robust pipeline from SMS to blockchain, powered by AI and threshold cryptography.
                    </p>
                </div>

                {/* Architecture Diagram */}
                <div className="arch-diagram perspective-container spotlight-card p-8 md:p-12 mb-14">
                    <pre className="text-[10px] sm:text-xs md:text-sm font-mono text-[var(--muted-foreground)] overflow-x-auto leading-relaxed">
                        {`User SMS ──▶ Android App (SMSReceiver) 
                  │
                  ▼
            POST /api/sms  ──▶  Regex Parser (fast)
                                    │
                              ┌─────┴─────┐
                              │ success?   │
                              ▼            ▼
                           Use it     Gemini AI (fallback)
                              │            │
                              └─────┬──────┘
                                    ▼
                            Intent Routing
                        ┌───────┼────────┐
                        ▼       ▼        ▼
                   get-addr  balance  transaction
                      │        │         │
                      ▼        ▼         ▼
                    DKG    chain-RPC   TSS Sign → Broadcast
                      │        │         │
                      └────────┴─────────┘
                                │
                                ▼
                         JSON Response
                                │
                                ▼
                    Android App (SMSSender) ──▶ SMS to User`}
                    </pre>
                </div>

                {/* Tech Stack Badges */}
                <div className="tech-stack">
                    <h3 className="text-center text-[11px] tracking-[0.2em] uppercase font-mono text-[var(--muted-foreground)] mb-8">
                        Built With
                    </h3>
                    <div className="flex flex-wrap justify-center gap-3">
                        {techStack.map((tech) => (
                            <div
                                key={tech.name}
                                className="tech-badge px-5 py-2.5 rounded-full border border-[var(--border)] spotlight-card text-sm font-medium hover:border-[var(--primary)]/40 transition-all duration-300 cursor-default flex items-center gap-2.5"
                            >
                                <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: tech.color }}
                                />
                                {tech.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
