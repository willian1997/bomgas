from django.db import migrations


def popular_produtos_iniciais(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")

    produtos = [
        {
            "nome": "🔥 Botijão de Gás",
            "preco": 120.00,
            "descricao": "Botijão de gás de cozinha 13kg.",
        },
        {
            "nome": "💧 Água Mineral",
            "preco": 30.00,
            "descricao": "Galão de água mineral 15 litros.",
        },
        {
            "nome": "🪵 Carvão",
            "preco": 70.00,
            "descricao": "Saco de carvão para churrasco 20kg.",
        },
    ]

    for item in produtos:
        Produto.objects.get_or_create(
            nome=item["nome"],
            defaults={
                "preco": item["preco"],
                "descricao": item["descricao"],
                "disponivel": True,
            },
        )


def reverter_produtos_iniciais(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")
    nomes = ["🔥 Botijão de Gás", "💧 Água Mineral", "🪵 Carvão"]
    Produto.objects.filter(nome__in=nomes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            popular_produtos_iniciais,
            reverse_code=reverter_produtos_iniciais,
        ),
    ]
