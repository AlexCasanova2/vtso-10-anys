import Link from "next/link";
import Image from "next/image";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className="brand" style={{ color: inverse ? "white" : undefined }} aria-label="Viladecans The Style Outlets">
      <Image src={inverse ? "/brand/viladecans-logo-white.svg" : "/brand/viladecans-logo.svg"} alt="Viladecans The Style Outlets" width={228} height={50} priority />
    </Link>
  );
}
