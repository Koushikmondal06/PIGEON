import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Github, Linkedin, ExternalLink } from 'lucide-react'
import { GlareCard } from '@/components/ui/glare-card'

gsap.registerPlugin(ScrollTrigger)

const team = [
    {
        name: 'Koushik Mondal',
        role: 'Full Stack Developer',
        bio: 'Building the bridge between SMS and blockchain. Passionate about decentralized systems and making crypto accessible to everyone.',
        github: 'https://github.com/Koushikmondal06',
        linkedin: '#',
        avatar: 'KM',
        gradient: 'from-[var(--primary)] to-[var(--accent)]',
    },
    {
        name: 'Himanshu Malik',
        role: 'Full Stack Developer',
        bio: 'Designing secure cryptographic protocols and scalable backend systems. Driven by the vision of financial inclusion through technology.',
        github: 'https://github.com/himanshumalik552',
        linkedin: '#',
        avatar: 'HM',
        gradient: 'from-[var(--accent)] to-[#10B981]',
    },
]

export function Team() {
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

        // Team cards — staggered entrance
        const cards = sectionRef.current.querySelectorAll('.team-card-3d')
        cards.forEach((card, i) => {
            gsap.fromTo(
                card,
                {
                    opacity: 0,
                    y: 80,
                    scale: 0.88,
                },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 1.2,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: sectionRef.current?.querySelector('.team-grid'),
                        start: 'top 85%',
                        end: 'top 50%',
                        scrub: 1,
                    },
                    delay: i * 0.15,
                }
            )
        })
    }, [])

    return (
        <section id="team" ref={sectionRef} className="relative z-10 py-32 md:py-48 px-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="section-header flex flex-col items-center text-center mb-32">
                    <span className="inline-block px-4 py-1.5 text-xs tracking-[0.3em] uppercase font-mono text-[var(--primary)] mb-6">
                        [ The Team ]
                    </span>
                    <h2 className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black uppercase tracking-[-0.05em] mb-8 leading-[0.9]">
                        Built By<br />
                        <span className="text-[var(--primary)]">Builders</span>
                    </h2>
                    <p className="text-[var(--muted-foreground)] max-w-3xl text-base md:text-lg lg:text-xl leading-relaxed">
                        Two developers on a mission to make crypto accessible through the simplest interface — SMS.
                    </p>
                </div>

                {/* Team Cards */}
                <div className="team-grid flex flex-wrap justify-center gap-10">
                    {team.map((member) => (
                        <div key={member.name} className="team-card-3d">
                            <GlareCard className="flex flex-col items-start justify-between p-8">
                                {/* Top — Avatar + Info */}
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div
                                            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center text-white font-bold text-lg`}
                                        >
                                            {member.avatar}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{member.name}</h3>
                                            <p className="text-xs text-neutral-400 font-mono">{member.role}</p>
                                        </div>
                                    </div>

                                    {/* Bio */}
                                    <p className="text-sm text-neutral-400 leading-relaxed">
                                        {member.bio}
                                    </p>
                                </div>

                                {/* Bottom — Social Links */}
                                <div className="flex items-center gap-3 mt-6 w-full">
                                    <a
                                        href={member.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:border-white/30 transition-all duration-300"
                                    >
                                        <Github size={16} />
                                    </a>
                                    <a
                                        href={member.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:border-white/30 transition-all duration-300"
                                    >
                                        <Linkedin size={16} />
                                    </a>
                                    <a
                                        href={member.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        View Profile <ExternalLink size={12} />
                                    </a>
                                </div>
                            </GlareCard>
                        </div>
                    ))}
                </div>

                {/* Project Link */}
                <div className="text-center mt-14">
                    <a
                        href="https://github.com/Koushikmondal06/PIGEON"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[var(--border)] spotlight-card text-sm font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all duration-300"
                    >
                        <Github size={16} />
                        View Project on GitHub
                    </a>
                </div>
            </div>
        </section>
    )
}
