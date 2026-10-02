import type { DeploymentGuideContent } from '../content/deployment'
import { deploymentReference } from '../content/deployment'

interface DeploymentGuideProps {
  content: DeploymentGuideContent
  onOpenGenerator: () => void
}

export default function DeploymentGuide({
  content,
  onOpenGenerator,
}: DeploymentGuideProps) {
  const navigateToSection = (id: string) => {
    const heading = document.getElementById(`deployment-guide-${id}`)
    heading?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }

  return (
    <div className="space-y-7 text-sm leading-relaxed sm:text-base">
      <div className="space-y-4">
        <p>{content.intro}</p>
        <p className="text-xs text-(--text-secondary) sm:text-sm">
          {content.verifiedLabel} {deploymentReference.verifiedAt}
          {' · Myriad '}{deploymentReference.myriadVersion}
          {' · com.myriad.config-generator '}{deploymentReference.generatorVersion}
        </p>
        <button
          type="button"
          onClick={onOpenGenerator}
          className="rounded-lg bg-(--text-primary) px-4 py-2.5 text-sm font-medium text-(--bg-primary) transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary)"
        >
          {content.openGenerator}
        </button>
      </div>

      <nav
        aria-label={content.contentsLabel}
        className="rounded-xl border border-black/10 bg-black/3 p-4 dark:border-white/10 dark:bg-white/3"
      >
        <h3 className="mb-3 font-semibold text-(--text-primary)">
          {content.contentsLabel}
        </h3>
        <ol className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          {content.sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                aria-controls={`deployment-guide-${section.id}`}
                onClick={() => navigateToSection(section.id)}
                className="text-left underline decoration-black/20 underline-offset-4 transition-colors hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary) dark:decoration-white/20"
              >
                {section.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {content.sections.map((section) => (
        <section key={section.id} className="min-w-0 space-y-3">
          <h3
            id={`deployment-guide-${section.id}`}
            tabIndex={-1}
            className="scroll-mt-6 text-lg font-semibold text-(--text-primary) focus:outline-none"
          >
            {section.title}
          </h3>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.list && (
            <ul className="list-disc space-y-2 pl-5">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.commands?.map((command) => (
            <div key={command.label} className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-(--text-primary)">
                {command.label}
              </p>
              <pre className="overflow-x-auto rounded-xl border border-black/10 bg-black/5 p-4 text-xs leading-relaxed text-(--text-primary) select-text sm:text-sm dark:border-white/10 dark:bg-white/5">
                <code>{command.code}</code>
              </pre>
            </div>
          ))}
          {section.note && (
            <aside className="rounded-xl border-l-4 border-(--color-primary) bg-black/3 px-4 py-3 text-sm dark:bg-white/3">
              {section.note}
            </aside>
          )}
          {section.links && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {section.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-(--text-primary)"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </section>
      ))}

      <section className="space-y-3 border-t border-black/10 pt-5 dark:border-white/10">
        <h3 className="font-semibold text-(--text-primary)">
          {content.resourcesLabel}
        </h3>
        <ul className="space-y-2 text-sm">
          {content.resources.map((resource) => (
            <li key={resource.href}>
              <a
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-(--text-primary)"
              >
                {resource.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
