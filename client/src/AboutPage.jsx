import { useState } from "react";
import "./AboutPage.css";

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=2200&q=85",
  story:
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=85",
  teaching:
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=85",
  languages:
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1400&q=85",
  technology:
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=85",
  community:
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=85",
};

const COPY = {
  en: {
    announcement: "Education, with intention.",
    nav: ["Who we are", "Our approach", "Certifications", "Contact"],
    explore: "Explore programs",
    heroEyebrow: "WELCOME TO SOLYCE",
    heroTitle: "Learn today. Open new possibilities.",
    heroText:
      "A learning academy helping you build language skills and professional capabilities for the opportunities ahead.",
    discover: "Discover Solyce",
    programs: "Explore our programs",
    scroll: "DISCOVER OUR ACADEMY",
    identityEyebrow: "01 / WHO WE ARE",
    identityTitle: "Learning should lead somewhere.",
    identityText:
      "Solyce is a learning academy built around purposeful education, guided practice and meaningful progress. We help learners develop the skills, confidence and knowledge they need to pursue their personal, academic and professional goals.",
    missionTitle: "Our mission",
    missionText:
      "Make structured, guided learning more accessible to people pursuing new opportunities.",
    visionTitle: "Our ambition",
    visionText:
      "Build a trusted learning environment where people can grow their skills and move forward with confidence.",
    valuesTitle: "Our principles",
    valuesText:
      "Clarity, practical learning, supportive instruction and a commitment to continuous progress.",
    approachEyebrow: "02 / THE SOLYCE APPROACH",
    approachTitle: "A clear path from learning to doing.",
    approachText:
      "We believe people learn best when they have a clear objective, guidance from an instructor and opportunities to put their knowledge into practice.",
    pillars: [
      {
        number: "01",
        title: "Learn with guidance",
        text: "Follow structured learning sessions supported by an instructor who helps you understand and progress.",
      },
      {
        number: "02",
        title: "Practise with purpose",
        text: "Put new skills into practice through activities, discussion and work connected to your learning objectives.",
      },
      {
        number: "03",
        title: "Build your next step",
        text: "Develop knowledge and confidence that you can apply to your academic, personal or professional journey.",
      },
    ],
    fieldsEyebrow: "03 / WHAT WE TEACH",
    fieldsTitle: "Skills for the next chapter.",
    fieldsText:
      "Our learning pathways bring together language development and technology-focused skills.",
    languageTitle: "Languages & international exams",
    languageText:
      "Develop communication skills in English, French and German, including preparation for selected international language examinations.",
    technologyTitle: "Technology & professional skills",
    technologyText:
      "Explore learning pathways in networking, systems, cybersecurity, cloud platforms, agile practices and digital creation tools.",
    certificationsEyebrow: "04 / CERTIFICATION PATHWAYS",
    certificationsTitle: "Prepare with a clear objective.",
    certificationsText:
      "Explore the international exams and professional certification pathways relevant to our planned and developing training offer.",
    languageCerts: "Languages",
    techCerts: "Technology & professional skills",
    examProviders: "Certification and exam providers",
    certificationNote:
      "Solyce provides or plans to provide preparation for selected exams. Certification availability depends on the program. Solyce is not represented as an accredited exam centre or official partner unless expressly confirmed.",
    commitmentEyebrow: "05 / OUR COMMITMENT",
    commitmentTitle: "Your goals deserve a clear path.",
    commitmentText:
      "Every learner starts from a different place. Our commitment is to offer structured guidance, purposeful practice and a learning experience built around the next step you want to take.",
    contactEyebrow: "06 / START A CONVERSATION",
    contactTitle: "Your next chapter starts here.",
    contactText:
      "Tell us what you want to achieve. Our team can help you explore the learning pathways and find a suitable starting point.",
    contactButton: "Contact our team",
    emailLabel: "Email",
    phoneLabel: "Phone / WhatsApp",
    locationLabel: "Location",
    email: "hello@solyce.com",
    phone: "+237 XXX XXX XXX",
    location: "Cameroon",
    contactPlaceholder:
      "Contact details shown here are provisional and can be updated.",
    finalTitle: "Ready to move forward?",
    finalText: "Discover a learning pathway that fits your goals.",
    finalButton: "Explore programs",
    footer: "Purposeful learning. Meaningful progress.",
    footerLinks: ["Programs", "About Solyce", "Contact"],
    disclaimer: "Certification preparation does not guarantee an exam result.",
  },
  fr: {
    announcement: "La formation, avec intention.",
    nav: ["Qui sommes-nous", "Notre approche", "Certifications", "Contact"],
    explore: "Découvrir les programmes",
    heroEyebrow: "BIENVENUE CHEZ SOLYCE",
    heroTitle: "Apprendre aujourd'hui. Ouvrir de nouvelles possibilités.",
    heroText:
      "Une académie qui vous accompagne dans le développement de vos compétences linguistiques et professionnelles pour saisir de nouvelles opportunités.",
    discover: "Découvrir Solyce",
    programs: "Découvrir nos programmes",
    scroll: "DÉCOUVRIR NOTRE ACADÉMIE",
    identityEyebrow: "01 / QUI SOMMES-NOUS",
    identityTitle: "Apprendre pour aller plus loin.",
    identityText:
      "Solyce est une académie de formation fondée sur un apprentissage structuré, une pratique accompagnée et une progression concrète. Nous aidons les apprenants à développer les compétences, la confiance et les connaissances nécessaires à leurs objectifs personnels, académiques et professionnels.",
    missionTitle: "Notre mission",
    missionText:
      "Rendre l'apprentissage structuré et accompagné plus accessible aux personnes qui souhaitent saisir de nouvelles opportunités.",
    visionTitle: "Notre ambition",
    visionText:
      "Créer un environnement de formation de confiance où chacun peut développer ses compétences et progresser avec assurance.",
    valuesTitle: "Nos principes",
    valuesText:
      "Clarté, pratique, accompagnement pédagogique et engagement en faveur d'une progression continue.",
    approachEyebrow: "02 / L'APPROCHE SOLYCE",
    approachTitle: "Un parcours clair, de l'apprentissage à la pratique.",
    approachText:
      "Nous pensons que l'on apprend mieux avec un objectif clair, l'accompagnement d'un formateur et des occasions concrètes de mettre ses connaissances en pratique.",
    pillars: [
      {
        number: "01",
        title: "Apprendre avec un formateur",
        text: "Suivez des séances structurées accompagnées par un formateur qui vous aide à comprendre et à progresser.",
      },
      {
        number: "02",
        title: "Pratiquer avec un objectif",
        text: "Mettez vos nouvelles compétences en pratique grâce à des activités, des échanges et des exercices liés à vos objectifs.",
      },
      {
        number: "03",
        title: "Préparer la prochaine étape",
        text: "Développez des connaissances et une confiance que vous pourrez mobiliser dans votre parcours personnel, académique ou professionnel.",
      },
    ],
    fieldsEyebrow: "03 / NOS FORMATIONS",
    fieldsTitle: "Des compétences pour la suite.",
    fieldsText:
      "Nos parcours de formation associent le développement linguistique et les compétences technologiques.",
    languageTitle: "Langues et examens internationaux",
    languageText:
      "Développez vos compétences en anglais, en français et en allemand, notamment avec une préparation à certains examens linguistiques internationaux.",
    technologyTitle: "Technologies et compétences professionnelles",
    technologyText:
      "Découvrez des parcours en réseaux, systèmes, cybersécurité, plateformes cloud, méthodes agiles et outils de création numérique.",
    certificationsEyebrow: "04 / PARCOURS DE CERTIFICATION",
    certificationsTitle: "Se préparer avec un objectif clair.",
    certificationsText:
      "Découvrez les examens internationaux et les parcours de certification professionnelle liés à notre offre de formation actuelle ou en développement.",
    languageCerts: "Langues",
    techCerts: "Technologies et compétences professionnelles",
    examProviders: "Organismes de certification et d'examen",
    certificationNote:
      "Solyce propose ou prévoit de proposer une préparation à certains examens. Leur disponibilité dépend du programme. Solyce n'est pas présenté comme un centre d'examen agréé ou un partenaire officiel sans confirmation expresse.",
    commitmentEyebrow: "05 / NOTRE ENGAGEMENT",
    commitmentTitle: "Vos objectifs méritent un parcours clair.",
    commitmentText:
      "Chaque apprenant part d'une situation différente. Notre engagement est de proposer un accompagnement structuré, une pratique utile et une expérience de formation adaptée à la prochaine étape que vous souhaitez franchir.",
    contactEyebrow: "06 / ÉCHANGEONS",
    contactTitle: "Votre prochain chapitre commence ici.",
    contactText:
      "Parlez-nous de vos objectifs. Notre équipe pourra vous aider à découvrir les parcours disponibles et à identifier un point de départ adapté.",
    contactButton: "Contacter notre équipe",
    emailLabel: "E-mail",
    phoneLabel: "Téléphone / WhatsApp",
    locationLabel: "Localisation",
    email: "hello@solyce.com",
    phone: "+237 XXX XXX XXX",
    location: "Cameroun",
    contactPlaceholder:
      "Les coordonnées affichées ici sont provisoires et pourront être mises à jour.",
    finalTitle: "Prêt à aller plus loin ?",
    finalText: "Découvrez un parcours de formation adapté à vos objectifs.",
    finalButton: "Découvrir les programmes",
    footer: "Apprendre avec intention. Progresser durablement.",
    footerLinks: ["Programmes", "À propos de Solyce", "Contact"],
    disclaimer: "La préparation à un examen ne garantit pas sa réussite.",
  },
};

const CERTIFICATIONS = [
  {
    title: "IELTS",
    category: "language",
    detail: "English",
    mark: "IELTS",
    logo: "../../public/images/IELTS_logo.svg.webp",
  },
  {
    title: "TOEFL",
    category: "language",
    detail: "English",
    mark: "TOEFL",
    logo: "../../public/images/ets-toefl-vector-logo.png",
  },
  {
    title: "TOEIC",
    category: "language",
    detail: "Professional English",
    mark: "TOEIC",
    logo: "../../public/images/TOEIC_logo.png",
  },
  {
    title: "TCF",
    category: "language",
    detail: "French",
    mark: "TCF",
    logo: "../../public/images/TEF_logotype_RVB-e1656620933872.jpg",
  },
  {
    title: "TEF",
    category: "language",
    detail: "French",
    mark: "TEF",
    logo: "../../public/images/TEF_logotype_RVB-e1656620933872.jpg",
  },
  {
    title: "DELF",
    category: "language",
    detail: "French",
    mark: "DELF",
    logo: "../../public/images/delf-dalf.png",
  },
  {
    title: "DALF",
    category: "language",
    detail: "French",
    mark: "DALF",
    logo: "../../public/images/delf-dalf.png",
  },
  {
    title: "Goethe-Zertifikat",
    category: "language",
    detail: "German",
    mark: "GOETHE",
    logo: "../../public/images/goethe-logo.png",
  },
  {
    title: "CompTIA Network+",
    category: "technology",
    detail: "Networking",
    mark: "CompTIA",
    logo: "../../public/images/NetworkPlus Logo Certified CE.jpg",
  },
  {
    title: "CompTIA Server+",
    category: "technology",
    detail: "Server infrastructure",
    mark: "CompTIA",
    logo: "../../public/images/comptia-logo.png",
  },
  {
    title: "CompTIA Security+",
    category: "technology",
    detail: "Cybersecurity",
    mark: "CompTIA",
    logo: "../../public/images/CompTIA_security-plus-logoSITE.jpg",
  },
  {
    title: "Cisco",
    category: "technology",
    detail: "Networking",
    mark: "CISCO",
    logo: "../../public/images/cisco-logo-png_seeklogo-30674.png",
  },
  {
    title: "CCNA",
    category: "technology",
    detail: "Cisco networking",
    mark: "CCNA",
    logo: "../../public/images/ccna.png",
  },
  {
    title: "AWS Solutions Architect – Associate",
    category: "technology",
    detail: "Cloud architecture",
    mark: "aws",
    logo: "../../public/images/aws-solutions-architect-associate.png",
  },
  {
    title: "AWS Developer – Associate",
    category: "technology",
    detail: "Cloud development",
    mark: "aws",
    logo: "../../public/images/aws-developer-associate.jfif",
  },
  {
    title: "Microsoft Azure",
    category: "technology",
    detail: "Cloud computing",
    mark: "AZURE",
    logo: "../../public/images/Microsoft_Azure_Logo.svg.webp",
  },
  {
    title: "Google Cloud",
    category: "technology",
    detail: "Cloud computing",
    mark: "GOOGLE",
    logo: "../../public/images/google-cloud-logo-1.png",
  },
  {
    title: "Scrum",
    category: "technology",
    detail: "Agile practices",
    mark: "SCRUM",
    logo: "../../public/images/scrum-logo.png",
  },
  {
    title: "Microsoft",
    category: "technology",
    detail: "Productivity and digital skills",
    mark: "Microsoft",
    logo: "../../public/images/m36520231221102358.png",
  },
  {
    title: "Adobe",
    category: "technology",
    detail: "Digital creation",
    mark: "Adobe",
    logo: "../../public/images/Adobe_Corporate_Logo.png",
  },
];

function Brand() {
  return (
    <a className="about-brand" href="/" aria-label="Solyce home">
      <span className="about-brand-mark">S</span>
      <span>
        solyce<span className="about-brand-dot">.</span>
      </span>
    </a>
  );
}

function Arrow() {
  return (
    <span className="about-arrow" aria-hidden="true">
      ↗
    </span>
  );
}

export default function AboutPage() {
  const [lang, setLang] = useState("en");
  const t = COPY[lang];

  const languageItems = CERTIFICATIONS.filter(
    (item) => item.category === "language",
  );
  const technologyItems = CERTIFICATIONS.filter(
    (item) => item.category === "technology",
  );

  return (
    <div className="about-page" lang={lang}>
      <div className="about-announcement">
        <span className="about-announcement-dot" />
        {t.announcement}
        <span className="about-announcement-divider">/</span>
        SOLYCE ACADEMY
      </div>

      <header className="about-header">
        <div className="about-container about-nav">
          <Brand />
          <nav className="about-nav-links" aria-label="Main navigation">
            <a href="#identity">{t.nav[0]}</a>
            <a href="#approach">{t.nav[1]}</a>
            <a href="#certifications">{t.nav[2]}</a>
            <a href="#contact">{t.nav[3]}</a>
          </nav>
          <div className="about-nav-actions">
            <div className="about-language-switch" aria-label="Choose language">
              <button
                type="button"
                onClick={() => setLang("fr")}
                aria-pressed={lang === "fr"}
                className={lang === "fr" ? "active" : ""}
              >
                FR
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={lang === "en" ? "active" : ""}
              >
                EN
              </button>
            </div>
            <a className="about-button about-button-dark" href="/#programs">
              {t.explore} <Arrow />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="about-hero">
          <img className="about-hero-image" src={IMAGES.hero} alt="" />
          <div className="about-hero-overlay" />
          <div className="about-hero-content about-container">
            <span className="about-eyebrow about-eyebrow-light">
              {t.heroEyebrow}
            </span>
            <h1>{t.heroTitle}</h1>
            <p>{t.heroText}</p>
            <div className="about-hero-actions">
              <a className="about-button about-button-lime" href="#identity">
                {t.discover} <Arrow />
              </a>
              <a className="about-hero-text-link" href="/#programs">
                {t.programs} <Arrow />
              </a>
            </div>
          </div>
          <div className="about-hero-bottom about-container">
            <span>{t.scroll}</span>
            <a href="#identity" aria-label="Scroll to introduction">
              ↓
            </a>
            <span>SOLYCE / 01</span>
          </div>
        </section>

        <section className="about-identity about-section" id="identity">
          <div className="about-container about-identity-grid">
            <div className="about-identity-copy">
              <span className="about-eyebrow">{t.identityEyebrow}</span>
              <h2>{t.identityTitle}</h2>
              <p className="about-lead">{t.identityText}</p>
              <a className="about-inline-link" href="/#programs">
                {t.programs} <Arrow />
              </a>
            </div>
            <div className="about-identity-image">
              <img src={IMAGES.story} alt="" loading="lazy" />
              <div className="about-image-overlay" />
              <div className="about-image-caption">
                <span>S.</span>
                <div>
                  <strong>{t.missionTitle}</strong>
                  <p>{t.missionText}</p>
                </div>
              </div>
              <span className="about-image-index">SOLYCE / 01</span>
            </div>
          </div>
          <div className="about-container about-values-grid">
            <article>
              <span>01 / MISSION</span>
              <h3>{t.missionTitle}</h3>
              <p>{t.missionText}</p>
            </article>
            <article>
              <span>02 / VISION</span>
              <h3>{t.visionTitle}</h3>
              <p>{t.visionText}</p>
            </article>
            <article>
              <span>03 / VALUES</span>
              <h3>{t.valuesTitle}</h3>
              <p>{t.valuesText}</p>
            </article>
          </div>
        </section>

        <section className="about-approach about-section" id="approach">
          <div className="about-container">
            <div className="about-section-heading">
              <div>
                <span className="about-eyebrow">{t.approachEyebrow}</span>
                <h2>{t.approachTitle}</h2>
              </div>
              <p>{t.approachText}</p>
            </div>
            <div className="about-pillars">
              {t.pillars.map((pillar, index) => (
                <article className="about-pillar" key={pillar.number}>
                  <div className="about-pillar-image">
                    <img
                      src={
                        [IMAGES.teaching, IMAGES.story, IMAGES.languages][index]
                      }
                      alt=""
                      loading="lazy"
                    />
                    <div className="about-pillar-overlay" />
                    <span>{pillar.number}</span>
                    <h3>{pillar.title}</h3>
                  </div>
                  <p>{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-fields about-section" id="fields">
          <div className="about-container">
            <div className="about-section-heading">
              <div>
                <span className="about-eyebrow">{t.fieldsEyebrow}</span>
                <h2>{t.fieldsTitle}</h2>
              </div>
              <p>{t.fieldsText}</p>
            </div>
            <div className="about-field-grid">
              <article className="about-field-card">
                <img src={IMAGES.languages} alt="" loading="lazy" />
                <div className="about-field-overlay" />
                <div className="about-field-content">
                  <span>01 / LANGUAGES</span>
                  <h3>{t.languageTitle}</h3>
                  <p>{t.languageText}</p>
                  <a href="/#programs">
                    {t.programs} <Arrow />
                  </a>
                </div>
              </article>
              <article className="about-field-card">
                <img src={IMAGES.technology} alt="" loading="lazy" />
                <div className="about-field-overlay" />
                <div className="about-field-content">
                  <span>02 / TECHNOLOGY</span>
                  <h3>{t.technologyTitle}</h3>
                  <p>{t.technologyText}</p>
                  <a href="/#programs">
                    {t.programs} <Arrow />
                  </a>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          className="about-certifications about-section"
          id="certifications"
        >
          <div className="about-container">
            <div className="about-section-heading">
              <div>
                <span className="about-eyebrow">{t.certificationsEyebrow}</span>
                <h2>{t.certificationsTitle}</h2>
              </div>
              <p>{t.certificationsText}</p>
            </div>

            <div className="about-certification-group">
              <div className="about-certification-heading">
                <h3>{t.languageCerts}</h3>
                <span>08 PATHWAYS</span>
              </div>
              <div className="about-certification-grid">
                {languageItems.map((item) => (
                  <article
                    className="about-certification-card"
                    key={item.title}
                  >
                    <div className="about-certification-logo">
                      {item.logo && (
                        <img
                          src={item.logo}
                          alt={`Logo ${item.mark}`}
                          loading="lazy"
                        />
                      )}
                    </div>

                    <strong>{item.title}</strong>
                    <span className="about-certification-detail">
                      {item.detail}
                    </span>
                  </article>
                ))}
              </div>
            </div>

            <div className="about-certification-group">
              <div className="about-certification-heading">
                <h3>{t.techCerts}</h3>
                <span>12 PATHWAYS</span>
              </div>
              <div className="about-certification-grid about-certification-grid-tech">
                {technologyItems.map((item) => (
                  <article
                    className="about-certification-card"
                    key={item.title}
                  >
                    <div className="about-certification-logo">
                      {item.logo && (
                        <img
                          src={item.logo}
                          alt={`Logo ${item.mark}`}
                          loading="lazy"
                        />
                      )}
                    </div>

                    <strong>{item.title}</strong>
                    <span className="about-certification-detail">
                      {item.detail}
                    </span>
                  </article>
                ))}

                <article className="about-certification-card about-provider-card">
                  <div className="about-certification-logo">
                    <img
                      src="../public/images/PEARSON-VUE.png"
                      alt="Logo Pearson VUE"
                      loading="lazy"
                    />
                  </div>

                  <strong>Pearson VUE</strong>
                  <span className="about-certification-detail">
                    Exam delivery provider
                  </span>
                </article>
              </div>
            </div>

            <p className="about-certification-note">{t.certificationNote}</p>
          </div>
        </section>

        <section className="about-commitment">
          <img src={IMAGES.community} alt="" loading="lazy" />
          <div className="about-commitment-overlay" />
          <div className="about-container about-commitment-content">
            <span className="about-eyebrow about-eyebrow-light">
              {t.commitmentEyebrow}
            </span>
            <h2>{t.commitmentTitle}</h2>
            <p>{t.commitmentText}</p>
          </div>
        </section>

        <section className="about-contact about-section" id="contact">
          <div className="about-container about-contact-grid">
            <div className="about-contact-copy">
              <span className="about-eyebrow">{t.contactEyebrow}</span>
              <h2>{t.contactTitle}</h2>
              <p>{t.contactText}</p>
              <a
                className="about-button about-button-dark"
                href="mailto:hello@solyce.com?subject=Solyce%20enquiry"
              >
                {t.contactButton} <Arrow />
              </a>
            </div>
            <div className="about-contact-panel">
              <article>
                <span>{t.emailLabel}</span>
                <a href="mailto:hello@solyce.com">{t.email}</a>
              </article>
              <article>
                <span>{t.phoneLabel}</span>
                <a href="tel:+237000000000">{t.phone}</a>
              </article>
              <article>
                <span>{t.locationLabel}</span>
                <strong>{t.location}</strong>
              </article>
              <p>{t.contactPlaceholder}</p>
            </div>
          </div>
        </section>

        <section className="about-final-cta">
          <div className="about-container about-final-cta-content">
            <div>
              <span className="about-eyebrow about-eyebrow-light">
                SOLYCE / YOUR NEXT CHAPTER
              </span>
              <h2>{t.finalTitle}</h2>
              <p>{t.finalText}</p>
            </div>
            <a className="about-button about-button-lime" href="/#programs">
              {t.finalButton} <Arrow />
            </a>
          </div>
        </section>
      </main>

      <footer className="about-footer">
        <div className="about-container about-footer-main">
          <div>
            <Brand />
            <p>{t.footer}</p>
          </div>
          <div className="about-footer-links">
            <a href="/#programs">{t.footerLinks[0]}</a>
            <a href="/about">{t.footerLinks[1]}</a>
            <a href="#contact">{t.footerLinks[2]}</a>
          </div>
          <div className="about-footer-contact">
            <span>GET IN TOUCH / CONTACT</span>
            <a href="mailto:hello@solyce.com">hello@solyce.com</a>
            <span>Cameroon / Cameroun</span>
          </div>
        </div>
        <div className="about-container about-footer-bottom">
          <span>© {new Date().getFullYear()} Solyce. All rights reserved.</span>
          <span>{t.disclaimer}</span>
        </div>
      </footer>
    </div>
  );
}
