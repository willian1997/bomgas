from django.contrib.auth.hashers import make_password
from django.db import migrations


def criar_admin_padrao(apps, schema_editor):
    User = apps.get_model("auth", "User")
    if not User.objects.filter(username="admin").exists():
        User.objects.create(
            username="admin",
            password=make_password("123456"),
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )


def reverter_admin_padrao(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_produto_categoria"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(
            criar_admin_padrao,
            reverse_code=reverter_admin_padrao,
        ),
    ]

