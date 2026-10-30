import json
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from .models import Produto, Pedido


class AutenticacaoFluxoTests(TestCase):

    def setUp(self):
        self.produto = Produto.objects.create(
            nome="Botijão P13",
            categoria="gas",
            preco=Decimal("120.00"),
            descricao="Gás 13kg",
            disponivel=True,
        )
        Pedido.objects.create(
            cliente="Mariana Oliveira",
            telefone="(14) 99712-4580",
            endereco="Rua Antiga",
            numero_endereco="10",
            bairro="Vila Velha",
            total=Decimal("120.00"),
            status="Entregue",
        )
        self.pedido_recente = Pedido.objects.create(
            cliente="Mariana Oliveira",
            telefone="(14) 99712-4580",
            endereco="Rua das Flores",
            numero_endereco="245",
            bairro="Centro",
            total=Decimal("120.00"),
            status="Em preparação",
        )

    def test_cabecalho_aponta_para_tela_entrar(self):
        for nome_rota in ["inicio", "produtos", "carrinho", "finalizar_pedido", "meus_pedidos"]:
            resp = self.client.get(reverse(nome_rota))
            self.assertEqual(resp.status_code, 200)
            self.assertContains(resp, f'href="{reverse("entrar")}"')

    def test_tela_entrar_exibe_duas_opcoes(self):
        resp = self.client.get(reverse("entrar"))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Sou Cliente")
        self.assertContains(resp, "Administrador")

    def test_login_cliente_por_telefone_identifica_sessao_e_preenche_checkout(self):
        resp = self.client.post(
            reverse("entrar"),
            {"tipo_login": "cliente", "telefone": "14997124580"},
            follow=True,
        )
        self.assertRedirects(resp, reverse("inicio"))
        self.assertContains(resp, "Olá, Mariana (Sair)")

        resp_checkout = self.client.get(reverse("finalizar_pedido"))
        self.assertEqual(resp_checkout.status_code, 200)
        self.assertContains(resp_checkout, 'value="Mariana Oliveira"')
        self.assertContains(resp_checkout, 'value="(14) 99712-4580"')
        self.assertContains(resp_checkout, 'value="Rua das Flores"')
        self.assertContains(resp_checkout, 'value="245"')
        self.assertContains(resp_checkout, 'value="Centro"')

        # Sair encerra a sessão do cliente
        resp_sair = self.client.get(reverse("sair"), follow=True)
        self.assertRedirects(resp_sair, reverse("inicio"))
        self.assertNotContains(resp_sair, "Olá, Mariana (Sair)")
        self.assertContains(resp_sair, "Entrar")

    def test_login_cliente_telefone_inexistente_exibe_erro(self):
        resp = self.client.post(
            reverse("entrar"),
            {"tipo_login": "cliente", "telefone": "(14) 90000-0000"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(self.client.session.get("cliente_logado"))
        self.assertContains(resp, "Nenhum cadastro encontrado")

    def test_admin_padrao_criado_com_hash_e_protecao_rotas(self):
        # Bloqueia acesso não autenticado ao painel e APIs admin
        for rota in [
            "admin_dashboard",
            "admin_pedidos",
            "admin_produtos",
            "admin_clientes",
            "admin_configuracoes",
        ]:
            resp = self.client.get(reverse(rota))
            self.assertEqual(resp.status_code, 302)
            self.assertIn(reverse("entrar"), resp["Location"])

        resp_api = self.client.get(reverse("api_admin_dashboard"))
        self.assertEqual(resp_api.status_code, 401)

        # Mesmo se o usuário admin for removido, o fluxo recria admin/123456 com hash
        User.objects.filter(username="admin").delete()
        resp_login = self.client.post(
            reverse("entrar"),
            {"tipo_login": "admin", "usuario": "admin", "senha": "123456"},
        )
        self.assertRedirects(resp_login, reverse("admin_dashboard"))

        admin_user = User.objects.get(username="admin")
        self.assertNotEqual(admin_user.password, "123456")
        self.assertTrue(admin_user.password.startswith("pbkdf2_"))
        self.assertTrue(admin_user.check_password("123456"))

        # Acesso liberado ao painel e menu sem item fake Relatórios
        resp_dash = self.client.get(reverse("admin_dashboard"))
        self.assertEqual(resp_dash.status_code, 200)
        self.assertNotContains(resp_dash, "Relatórios")
        self.assertContains(resp_dash, reverse("admin_configuracoes"))

        # Botão Sair encerra a sessão e volta para a home do cliente
        resp_logout = self.client.get(reverse("sair"))
        self.assertRedirects(resp_logout, reverse("inicio"))
        resp_pos_logout = self.client.get(reverse("admin_dashboard"))
        self.assertEqual(resp_pos_logout.status_code, 302)

    def test_alteracao_senha_admin_valida_atual_e_salva_novo_hash(self):
        # Login como admin padrão
        self.client.post(
            reverse("entrar"),
            {"tipo_login": "admin", "usuario": "admin", "senha": "123456"},
        )

        # Senha atual incorreta não altera
        resp_erro = self.client.post(
            reverse("admin_configuracoes"),
            {
                "senha_atual": "errada",
                "nova_senha": "nova1234",
                "confirmar_senha": "nova1234",
            },
        )
        self.assertEqual(resp_erro.status_code, 200)
        self.assertContains(resp_erro, "incorreta")

        # Alteração válida
        resp_ok = self.client.post(
            reverse("admin_configuracoes"),
            {
                "senha_atual": "123456",
                "nova_senha": "nova1234",
                "confirmar_senha": "nova1234",
            },
        )
        self.assertEqual(resp_ok.status_code, 200)
        self.assertContains(resp_ok, "Senha alterada com sucesso!")

        # Permanece autenticado no painel após trocar a senha
        self.assertEqual(self.client.get(reverse("admin_dashboard")).status_code, 200)

        admin_user = User.objects.get(username="admin")
        self.assertTrue(admin_user.password.startswith("pbkdf2_"))
        self.assertFalse(admin_user.check_password("123456"))
        self.assertTrue(admin_user.check_password("nova1234"))

        # Novo login exige a nova senha
        self.client.get(reverse("sair"))
        resp_antiga = self.client.post(
            reverse("entrar"),
            {"tipo_login": "admin", "usuario": "admin", "senha": "123456"},
        )
        self.assertEqual(resp_antiga.status_code, 200)
        self.assertContains(resp_antiga, "incorretos")

        resp_nova = self.client.post(
            reverse("entrar"),
            {"tipo_login": "admin", "usuario": "admin", "senha": "nova1234"},
        )
        self.assertRedirects(resp_nova, reverse("admin_dashboard"))

    def test_cliente_logado_nao_acessa_configuracoes_admin(self):
        self.client.post(
            reverse("entrar"),
            {"tipo_login": "cliente", "telefone": "(14) 99712-4580"},
        )
        resp = self.client.post(
            reverse("admin_configuracoes"),
            {
                "senha_atual": "123456",
                "nova_senha": "hacker123",
                "confirmar_senha": "hacker123",
            },
        )
        self.assertEqual(resp.status_code, 302)
        self.assertIn(reverse("entrar"), resp["Location"])

    def test_fluxo_pedido_anonimo_continua_funcionando(self):
        payload = {
            "cliente": "João Teste",
            "telefone": "(14) 98888-7777",
            "endereco": "Av. Paulista",
            "numero_endereco": "1000",
            "bairro": "Bela Vista",
            "observacao": "",
            "produtos": [
                {
                    "id": self.produto.id,
                    "nome": self.produto.nome,
                    "preco": 120.00,
                    "quantidade": 1,
                }
            ],
            "total": 120.00,
        }
        resp = self.client.post(
            reverse("api_pedidos"),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)

        # Cliente recém-cadastrado já consegue se identificar pelo telefone
        resp_login = self.client.post(
            reverse("entrar"),
            {"tipo_login": "cliente", "telefone": "14988887777"},
            follow=True,
        )
        self.assertContains(resp_login, "Olá, João (Sair)")
