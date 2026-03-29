// Copyright (c) 2024, EntreTech and contributors
// For license information, please see license.txt

frappe.ui.form.on("Class Group", {
	refresh(frm) {
		frm.set_query("class_teacher", () => ({
			filters: { is_active: 1 },
		}));

		if (!frm.is_new()) {
			// Primary student management buttons (standalone, prominent)
			frm.add_custom_button(__("Adicionar Aluno(s)"), () => add_students_dialog(frm));

			const has_students = (frm.doc.students || []).length > 0;
			if (has_students) {
				frm.add_custom_button(
					__("Remover Aluno"),
					() => remove_student_dialog(frm)
				);
			}

			// Secondary navigation
			frm.add_custom_button(
				__("Pauta de Notas"),
				() => frappe.new_doc("Grade Entry", { class_group: frm.doc.name }),
				__("Criar")
			);
			frm.add_custom_button(
				__("Presença"),
				() => frappe.new_doc("Student Attendance", { class_group: frm.doc.name }),
				__("Criar")
			);
			frm.add_custom_button(
				__("Promoção de Alunos"),
				() => frappe.new_doc("Student Promotion", { class_group: frm.doc.name }),
				__("Criar")
			);

			frm.add_custom_button(
				__("Ver Alocações"),
				() => frappe.set_route("List", "Student Group Assignment", {
					class_group: frm.doc.name,
				}),
				__("Ver")
			);

			frm.add_custom_button(
				__("Reconstruir Pauta"),
				() => rebuild_roster(frm),
				__("Acções")
			);
		}

		// Capacity indicator
		const count = frm.doc.student_count || 0;
		const max = frm.doc.max_students || 0;
		if (max > 0 && count >= max) {
			frm.dashboard.set_headline_alert(
				__("Turma com capacidade esgotada ({0}/{1} alunos)", [count, max]),
				"red"
			);
		} else if (max > 0) {
			frm.dashboard.set_headline_alert(
				__("{0}/{1} alunos", [count, max]),
				count / max >= 0.9 ? "orange" : "green"
			);
		}
	},
});

// ---------------------------------------------------------------------------
// Student management dialogs
// ---------------------------------------------------------------------------

function add_students_dialog(frm) {
	const d = new frappe.ui.Dialog({
		title: __("Adicionar Alunos à Turma: {0}", [frm.doc.group_name]),
		size: "extra-large",
		fields: [
			{
				fieldname: "selector_html",
				fieldtype: "HTML"
			}
		],
		primary_action_label: __("Atribuir Selecionados"),
		primary_action() {
			if (!d.selected_students || !d.selected_students.length) {
				frappe.msgprint(__("Selecione pelo menos um aluno à direita."));
				return;
			}
			const student_ids = d.selected_students.map(s => s.name);
			frappe.call({
				method: "escola.escola.doctype.class_group.class_group.add_students_to_group",
				args: {
					class_group_name: frm.doc.name,
					students: JSON.stringify(student_ids),
				},
				freeze: true,
				freeze_message: __("A atribuir alunos..."),
				callback(r) {
					if (r.exc) return;
					d.hide();
					const { created, skipped, errors } = r.message;
					if (errors && errors.length) {
						let items = errors.map(e => `<li><b>${e.student}</b>: ${e.error}</li>`).join("");
						frappe.msgprint({ title: __("Erros na atribuição"), message: `<ul>${items}</ul>`, indicator: "orange" });
					}
					let parts = [];
					if (created > 0) parts.push(__("{0} aluno(s) atribuído(s)", [created]));
					if (skipped > 0) parts.push(__("{0} ignorado(s)", [skipped]));
					if (parts.length) frappe.show_alert({ message: parts.join(" · "), indicator: created > 0 ? "green" : "blue" });
					frm.reload_doc();
				}
			});
		}
	});

	d.available_students = [];
	d.selected_students = [];

	const html = `
		<style>
			.student-selector-split { display: flex; gap: 20px; height: 55vh; min-height: 450px; padding: 10px 0; }
			.student-pane { flex: 1; display: flex; flex-direction: column; background: var(--bg-light-gray); border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden; }
			.student-pane-header { padding: 12px 15px; border-bottom: 1px solid var(--border-color); background: var(--fg-color); display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 14px; }
			.student-search { width: 100%; border: none; border-bottom: 1px solid var(--border-color); padding: 12px 15px; background: transparent; outline: none; font-size: 13px; color: var(--text-color); }
			.student-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
			.student-card { display: flex; align-items: center; padding: 10px 14px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
			.student-card:hover { border-color: var(--primary-color); transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.06); }
			.student-card .avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; margin-right: 14px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
			.student-info { flex: 1; min-width: 0; }
			.student-info .name { font-weight: 600; font-size: 13px; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.student-info .code { font-size: 11px; color: var(--text-muted); margin-top:2px; }
			.action-icon { opacity: 0; font-size: 18px; margin-left: 10px; transition: 0.2s ease; color: var(--text-muted); }
			.student-card:hover .action-icon { opacity: 1; color: var(--primary-color); transform: scale(1.1); }
			.student-list-empty { padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
			.student-list-empty svg { width: 40px; height: 40px; opacity: 0.5; }
		</style>
		<div class="student-selector-split">
			<div class="student-pane">
				<div class="student-pane-header">
					<span>🎓 Alunos Disponíveis</span>
					<span class="badge badge-default" id="count-avail">0</span>
				</div>
				<input type="text" class="student-search" id="search-avail" placeholder="🔍 Pesquisar por nome ou código..." autocomplete="off" />
				<div class="student-list" id="list-avail">
					<div class="student-list-empty">A carregar banco de alunos...</div>
				</div>
			</div>
			
			<div class="student-pane" style="background: var(--bg-color);">
				<div class="student-pane-header" style="background: var(--bg-light-gray);">
					<span>✅ Selecionados para Adicionar</span>
					<span class="badge badge-success" id="count-sel">0</span>
				</div>
				<div class="student-list" id="list-sel">
					<div class="student-list-empty">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
						Nenhum aluno selecionado. <br>Clique num aluno à esquerda para adicionar na cesta.
					</div>
				</div>
			</div>
		</div>
	`;

	requestAnimationFrame(() => {
		const wrapper = d.fields_dict.selector_html.$wrapper;
		wrapper.html(html);

		frappe.call({
			method: "escola.escola.doctype.class_group.class_group.get_available_students_for_group",
			args: { class_group_name: frm.doc.name },
			callback(r) {
				if (r.message) {
					d.available_students = r.message;
					render_lists();
				}
			}
		});

		wrapper.find("#search-avail").on("input", function() {
			const q = $(this).val().toLowerCase();
			render_list("avail", d.available_students, q, "Nenhum aluno correspondente encontrado.");
		});

		function get_initials(name) {
			const p = (name || "").split(" ");
			if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
			return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
		}

		function render_lists() {
			const q = wrapper.find("#search-avail").val().toLowerCase();
			render_list("avail", d.available_students, q, "Todos os alunos activos já foram adicionados a esta turma ou não existem mais alunos.");
			render_list("sel", d.selected_students, "", "O cesto está vazio. Clique num aluno à esquerda para adicionar.");
			
			wrapper.find("#count-avail").text(d.available_students.length);
			wrapper.find("#count-sel").text(d.selected_students.length);
		}

		function render_list(type, data, query, empty_msg) {
			const $container = wrapper.find(`#list-${type}`);
			$container.empty();
			
			const filtered = query ? data.filter(s => s.full_name.toLowerCase().includes(query) || (s.student_code && s.student_code.toLowerCase().includes(query))) : data;

			if (!filtered.length) {
				$container.html(`<div class="student-list-empty">${empty_msg}</div>`);
				return;
			}

			// Add a subtle slide-in delay
			let delay = 0;
			filtered.forEach((s) => {
				const icon = type === "avail" ? "➜" : "✕";
				const $card = $(`
					<div class="student-card" data-id="${s.name}" style="animation: slideIn 0.2s ease ${delay}s both;">
						<div class="avatar">${get_initials(s.full_name)}</div>
						<div class="student-info">
							<div class="name">${s.full_name}</div>
							<div class="code">${s.student_code || s.name}</div>
						</div>
						<div class="action-icon" style="${type === 'sel' ? 'color: var(--error-color); opacity: 0.8;' : ''}">${icon}</div>
					</div>
				`);
				
				delay += 0.02; // Stagger effect

				$card.on("click", () => {
					if (type === "avail") {
						d.available_students = d.available_students.filter(x => x.name !== s.name);
						d.selected_students.push(s);
					} else {
						d.selected_students = d.selected_students.filter(x => x.name !== s.name);
						d.available_students.push(s);
						d.available_students.sort((a,b) => a.full_name.localeCompare(b.full_name));
					}
					render_lists();
				});

				$container.append($card);
			});
		}
		
		// Keyframes inside wrapper just in case 
		if (!document.getElementById("student-anim")) {
		    $("head").append(`<style id="student-anim">@keyframes slideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }</style>`);
		}
	});

	d.show();
}

function remove_student_dialog(frm) {
	const roster = frm.doc.students || [];
	if (!roster.length) {
		frappe.msgprint(__("Não há alunos nesta turma."));
		return;
	}

	const d = new frappe.ui.Dialog({
		title: __("Remover Aluno da Turma"),
		fields: [
			{
				fieldname: "student",
				fieldtype: "Link",
				options: "Student",
				label: __("Aluno"),
				reqd: 1,
				description: __("Apenas alunos actualmente nesta turma são apresentados."),
				get_query: () => ({
					filters: {
						name: ["in", roster.map((r) => r.student)],
					},
				}),
			},
		],
		primary_action_label: __("Remover da Turma"),
		primary_action(values) {
			frappe.confirm(
				__("Confirma a remoção de <b>{0}</b> desta turma? O registo de alocação ficará marcado como Encerrado.", [values.student]),
				() => {
					frappe.call({
						method: "escola.escola.doctype.class_group.class_group.remove_student_from_group",
						args: {
							class_group_name: frm.doc.name,
							student: values.student,
						},
						callback(r) {
							if (r.exc) return;
							d.hide();
							frappe.show_alert({
								message: __("Aluno removido da turma."),
								indicator: "green",
							});
							frm.reload_doc();
						},
					});
				}
			);
		},
	});

	d.show();
}

// ---------------------------------------------------------------------------
// Rebuild roster
// ---------------------------------------------------------------------------

function rebuild_roster(frm) {
	frappe.confirm(
		__("Isto irá reconstruir a lista de alunos a partir das Alocações de Turma activas. Continuar?"),
		() => {
			frappe.call({
				method: "escola.escola.doctype.class_group.class_group.rebuild_roster",
				args: { class_group_name: frm.doc.name },
				freeze: true,
				freeze_message: __("A reconstruir a pauta…"),
				callback(r) {
					if (r.message !== undefined) {
						frappe.show_alert({
							message: __("Pauta reconstruída com {0} aluno(s).", [r.message]),
							indicator: "green",
						});
						frm.reload_doc();
					}
				},
			});
		}
	);
}
