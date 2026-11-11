import Cards from "@cloudscape-design/components/cards";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useSeguirEnlace } from "@/compartido/navegacion";

export interface Acceso {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
}

export function AccesosRapidos({ accesos }: { accesos: Acceso[] }) {
  const seguir = useSeguirEnlace();
  return (
    <Cards
      variant="container"
      header={<Header variant="h2">Accesos rápidos</Header>}
      items={accesos}
      trackBy="id"
      ariaLabels={{ cardsLabel: "Accesos rápidos", itemSelectionLabel: () => "", selectionGroupLabel: "" }}
      cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }, { minWidth: 900, cards: 3 }]}
      cardDefinition={{
        header: (a) => (
          <Link href={a.href} onFollow={seguir} fontSize="heading-m">
            {a.titulo}
          </Link>
        ),
        sections: [{ id: "descripcion", content: (a) => a.descripcion }],
      }}
    />
  );
}
