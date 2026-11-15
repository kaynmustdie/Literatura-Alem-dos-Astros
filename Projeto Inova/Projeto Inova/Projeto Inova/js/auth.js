document.addEventListener("DOMContentLoaded", () => {
    const usuarioSalvo = localStorage.getItem("usuarioLogado");
    const listaDropdown = document.getElementById("listaDropdownUsuario");
    const triggerUsuario = document.getElementById("navTextoUsuario");
    const navAvatar = document.getElementById("navAvatar");

    if (!usuarioSalvo || !listaDropdown || !triggerUsuario) return;

    const user = JSON.parse(usuarioSalvo);

    // Atualiza "Usuário ▾" para o nome de usuário logado
    triggerUsuario.querySelector("span").textContent = `${user.usuario} ▾`;

    // Exibe a foto de perfil ao lado do nome, se existir
    if (user.foto && navAvatar) {
        navAvatar.src = user.foto;
        navAvatar.style.display = "inline-block";
    }

// Troca os itens do dropdown para Minha Conta e Sair
 // Dentro do js/auth.js, quando usuarioSalvo existir:
listaDropdown.innerHTML = `
    <li><a href="perfil.html">Minha Conta</a></li>
    <li><a href="#" id="btnLogout">Sair</a></li>
`;

window.addEventListener("load", () => {
    try {
        const usuarioSalvo = localStorage.getItem("usuarioLogado");
        const listaDropdown = document.getElementById("listaDropdownUsuario");
        const triggerUsuario = document.getElementById("navTextoUsuario");
        const navAvatar = document.getElementById("navAvatar");

        if (!usuarioSalvo || !listaDropdown || !triggerUsuario) return;

        const user = JSON.parse(usuarioSalvo);
        const spanTexto = triggerUsuario.querySelector("span");
        
        if (spanTexto) {
            spanTexto.textContent = `${user.usuario} ▾`;
        }

        if (user.foto && navAvatar) {
            navAvatar.src = user.foto;
            navAvatar.style.display = "inline-block";
        }

        listaDropdown.innerHTML = `
            <li><a href="perfil.html">Minha Conta</a></li>
            <li><a href="#" id="btnLogout">Sair</a></li>
        `;

        const btnLogout = document.getElementById("btnLogout");
        if (btnLogout) {
            btnLogout.addEventListener("click", (e) => {
                e.preventDefault();
                localStorage.removeItem("usuarioLogado");
                window.location.href = "login.html";
            });
        }
    } catch (erro) {
        console.warn("Aviso no auth.js:", erro);
    }
});

    document.getElementById("btnLogout").addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("usuarioLogado");
        window.location.href = "../html/login.html";
    });
});

// --- TRANSIÇÃO SUAVE ENTRE PÁGINAS ---
document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("pageshow", () => {
        document.body.classList.remove("pagina-saindo");
    });

    // Aplica o fade-out ao clicar em links internos
    document.querySelectorAll("a[href]").forEach(link => {
        link.addEventListener("click", function (e) {
            const destino = this.getAttribute("href");

            // Ignora links vazios, botões de logout (#), âncoras na mesma página ou links externos
            if (!destino || destino.startsWith("#") || destino.startsWith("http") || this.target === "_blank") {
                return;
            }

            e.preventDefault(); // Segura a troca imediata
            document.body.classList.add("pagina-saindo"); // Inicia o fade-out

            setTimeout(() => {
                window.location.href = destino; // Muda de página após a animação
            }, 150);
        });
    });
});

