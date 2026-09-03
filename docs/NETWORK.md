# Rede e acesso dos jogadores

## Rede local

O servidor publica `19132/UDP`. Jogadores na mesma rede usam:

```text
IP-DO-COMPUTADOR:19132
```

No Windows, execute `scripts/open-firewall.ps1` como Administrador. No Linux,
libere UDP 19132 no firewall utilizado pela distribuição.

## Internet: escolha uma das opções

### Opção A — redirecionamento no roteador

Redirecione UDP 19132 do roteador para o IPv4 local fixo do computador. Essa é
a rota mais direta, mas expõe o serviço Bedrock à internet e pode não funcionar
quando o provedor usa CGNAT.

Use uma reserva DHCP para o computador não trocar de endereço. Nunca encaminhe
a porta 8080 do painel.

### Opção B — túnel de jogos com UDP

Use um serviço que ofereça encaminhamento UDP para Minecraft Bedrock, como
playit.gg, seguindo a documentação e os termos do fornecedor. É útil quando não
há acesso ao roteador ou existe CGNAT.

### Opção C — Cloudflare Spectrum

Cloudflare Spectrum é o produto de proxy de camada 4 capaz de trabalhar com
TCP/UDP. A disponibilidade de UDP e os limites variam por plano, então confirme
as condições atuais antes de contratar. O Cloudflare Tunnel HTTP usado pelo
painel, isoladamente, não substitui essa camada para o tráfego Bedrock.

## Diagnóstico

1. Confirme que o painel mostra **Servidor online**.
2. Confira `docker compose ps`.
3. Teste primeiro na mesma rede Wi-Fi.
4. Confirme que o perfil da rede Windows está como **Privada**.
5. Verifique a regra de UDP 19132 no firewall.
6. Só depois teste o endereço externo.

Sites comuns de “testar porta” costumam testar TCP e podem indicar porta fechada
mesmo quando o serviço UDP está correto. O melhor teste é um cliente Bedrock em
outra rede.
