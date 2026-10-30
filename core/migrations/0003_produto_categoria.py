from django.db import migrations, models


def categorizar_produtos_existentes(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")

    for produto in Produto.objects.all():
        nome = produto.nome.lower()
        if "água" in nome or "agua" in nome:
            produto.categoria = "agua"
        elif "carvão" in nome or "carvao" in nome:
            produto.categoria = "carvao"
        else:
            produto.categoria = "gas"
        produto.save(update_fields=["categoria"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_popular_produtos_iniciais"),
    ]

    operations = [
        migrations.AddField(
            model_name="produto",
            name="categoria",
            field=models.CharField(
                choices=[("gas", "Gás"), ("agua", "Água"), ("carvao", "Carvão")],
                default="gas",
                max_length=20,
            ),
        ),
        migrations.RunPython(
            categorizar_produtos_existentes,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
