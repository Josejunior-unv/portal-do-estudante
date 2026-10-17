# Recuperação e troca de senha por e-mail

## Como funciona

| Situação | Onde | O que acontece |
| --- | --- | --- |
| Esqueceu a senha | Login → "Esqueceu a senha?" | `resetPasswordForEmail` envia um link. A mensagem é sempre neutra (não revela se o e-mail tem conta). |
| Clicou no link do e-mail | `/redefinir-senha` | O Supabase abre uma sessão de recuperação e a tela pede a nova senha (`updateUser`). |
| Link expirado/já usado | `/redefinir-senha` | A tela lê o erro do `#hash` da URL e oferece enviar um novo link. |
| Logado e quer trocar | Sidebar (aluno) ou cabeçalho (admin) → "Alterar senha" | Confirma a senha atual e grava a nova. |

Código em `src/features/auth/`: `authService.js` (regras + chamadas),
`RedefinirSenha.jsx`, `AlterarSenhaModal.jsx` e o modo `recuperar` em
`Login.jsx`. O `AuthProvider.jsx` redireciona para `/redefinir-senha` quando
recebe o evento `PASSWORD_RECOVERY`.

## Configuração obrigatória no painel do Supabase

1. **Authentication → URL Configuration**
   - *Site URL*: `https://vest-app-nine.vercel.app`
   - *Redirect URLs* (adicione as duas):
     - `https://vest-app-nine.vercel.app/redefinir-senha`
     - `http://localhost:5173/redefinir-senha`

   Sem isso o Supabase manda o usuário para a *Site URL* (o app ainda o
   redireciona para a tela certa, mas é melhor deixar explícito).

2. **SMTP próprio (Authentication → Emails → SMTP Settings)**. O e-mail
   embutido do Supabase envia só ~2 por hora, então não serve para alunos
   reais. Use o Resend (plano grátis de 3.000/mês):
   - Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = API key do Resend
   - Remetente: um endereço de um domínio verificado no Resend
   - Depois aumente o limite em **Authentication → Rate Limits → emails/hora**

3. **Template em português (Authentication → Emails → Templates → Reset Password)**

   Assunto: `Redefina sua senha — UERJ Para Todos`

   ```html
   <h2>Redefinir senha</h2>
   <p>Recebemos um pedido para redefinir a senha da sua conta no Pré-Vestibular UERJ Para Todos.</p>
   <p><a href="{{ .ConfirmationURL }}">Criar uma nova senha</a></p>
   <p>O link vale por 1 hora. Se você não pediu isso, pode ignorar este e-mail; sua senha continua a mesma.</p>
   ```

4. (Opcional) Religar **Confirm email** em *Authentication → Providers → Email*
   quando o SMTP estiver configurado, para que só e-mails reais criem contas.
