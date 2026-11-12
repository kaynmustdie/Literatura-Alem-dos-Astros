const API_URL = 'http://localhost:3000/api'; // Endereço do seu servidor

// 1. Carregar resenhas ao abrir a página
document.addEventListener('DOMContentLoaded', carregarResenhas);

async function carregarResenhas() {
    const resposta = await fetch(`${API_URL}/resenhas`);
    const resenhas = await resposta.json();
    
    const container = document.getElementById('listaResenhas');
    container.innerHTML = ''; // Limpa antes de renderizar

    resenhas.forEach(resenha => {
        const estrelas = '★'.repeat(resenha.nota) + '☆'.repeat(5 - resenha.nota);
        
        // Monta os comentários já existentes
        const htmlComentarios = resenha.comentarios.map(c => 
            `<p><strong>${c.nome_usuario}:</strong> ${c.comentario}</p>`
        ).join('');

        container.innerHTML += `
            <article class="card-resenha">
                <h3>${resenha.livro} <span>(${estrelas})</span></h3>
                <small>Por: <strong>${resenha.nome_usuario}</strong></small>
                <p>${resenha.texto}</p>
                
                <!-- Interação: Curtir -->
                <button onclick="curtirResenha(${resenha.id})">
                    👍 Curtir (${resenha.curtidas})
                </button>

                <!-- Interação: Comentar -->
                <div class="comentarios-box">
                    <h4>Comentários:</h4>
                    ${htmlComentarios || '<p>Seja o primeiro a comentar!</p>'}
                    <form onsubmit="enviarComentario(event, ${resenha.id})">
                        <input type="text" placeholder="Seu nome" required class="com-nome">
                        <input type="text" placeholder="Escreva um comentário..." required class="com-texto">
                        <button type="submit">Comentar</button>
                    </form>
                </div>
            </article>
            <hr>
        `;
    });
}

// 2. Enviar nova resenha
document.getElementById('resenhaForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que a página recarregue

    const dados = {
        nome: document.getElementById('nome').value,
        livro: document.getElementById('livro').value,
        nota: document.getElementById('nota').value,
        texto: document.getElementById('texto').value
    };

    await fetch(`${API_URL}/resenhas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    e.target.reset(); // Limpa o formulário
    carregarResenhas(); // Atualiza a lista na tela
});

// 3. Função para curtir
async function curtirResenha(id) {
    await fetch(`${API_URL}/resenhas/${id}/curtir`, { method: 'POST' });
    carregarResenhas();
}

// 4. Função para comentar
async function enviarComentario(e, resenhaId) {
    e.preventDefault();
    const form = e.target;
    const dados = {
        nome: form.querySelector('.com-nome').value,
        comentario: form.querySelector('.com-texto').value
    };

    await fetch(`${API_URL}/resenhas/${resenhaId}/comentar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    carregarResenhas();
}
