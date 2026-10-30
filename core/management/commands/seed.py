from django.core.management.base import BaseCommand
from seed import popular_banco


class Command(BaseCommand):
    help = "Popula o banco SQLite com produtos, clientes e pedidos realistas para apresentacao."

    def handle(self, *args, **options):
        resumo = popular_banco(limpar_existentes=True)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed concluido! {resumo['produtos']} produtos, "
                f"{resumo['clientes']} clientes e {resumo['pedidos']} pedidos criados."
            )
        )

