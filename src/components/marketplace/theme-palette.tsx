import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TOKENS = [
  { name: "background", swatchClass: "bg-background", textClass: "text-foreground" },
  { name: "foreground", swatchClass: "bg-foreground", textClass: "text-background" },
  { name: "card", swatchClass: "bg-card", textClass: "text-card-foreground" },
  { name: "primary", swatchClass: "bg-primary", textClass: "text-primary-foreground" },
  {
    name: "secondary",
    swatchClass: "bg-secondary",
    textClass: "text-secondary-foreground",
  },
  { name: "accent", swatchClass: "bg-accent", textClass: "text-accent-foreground" },
  { name: "muted", swatchClass: "bg-muted", textClass: "text-muted-foreground" },
  {
    name: "destructive",
    swatchClass: "bg-destructive",
    textClass: "text-primary-foreground",
  },
  { name: "chart-1", swatchClass: "bg-chart-1", textClass: "text-foreground" },
  { name: "chart-2", swatchClass: "bg-chart-2", textClass: "text-foreground" },
  { name: "chart-3", swatchClass: "bg-chart-3", textClass: "text-background" },
  { name: "chart-4", swatchClass: "bg-chart-4", textClass: "text-foreground" },
  { name: "chart-5", swatchClass: "bg-chart-5", textClass: "text-foreground" },
];

export function ThemePalette() {
  return (
    <Card className="border-border/70 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm tracking-wide uppercase">
          Theme Tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOKENS.map((token) => (
          <div
            key={token.name}
            className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{token.name}</span>
            <span
              className={`${token.swatchClass} ${token.textClass} rounded-md px-2 py-1 text-[11px] font-medium`}
            >
              Aa
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
