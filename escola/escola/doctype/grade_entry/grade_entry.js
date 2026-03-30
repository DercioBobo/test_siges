// Copyright (c) 2024, EntreTech and contributors
// For license information, please see license.txt

frappe.ui.form.on("Grade Entry", {
	refresh(frm) {
		set_queries(frm);

		frm.add_custom_button(__("Carregar Alunos e Disciplinas"), () => {
			load_grade_rows(frm);
		});
	},

	academic_year(frm) {
		frm.set_value("academic_term", null);
		frm.set_value("class_group", null);
		set_queries(frm);
	},

	school_class(frm) {
		frm.set_value("class_group", null);
		set_queries(frm);
	},

	class_group(frm) {
		set_queries(frm);
	},
});

frappe.ui.form.on("Grade Entry Row", {
	form_render(frm, cdt, cdn) {
		_inject_score_inputs(frm, cdt, cdn);
	},

	is_absent(frm, cdt, cdn) {
		const row = frappe.get_doc(cdt, cdn);
		if (row.is_absent) {
			// Clear scores when marking absent
			frappe.model.set_value(cdt, cdn, "scores_json", JSON.stringify({}));
			frappe.model.set_value(cdt, cdn, "trimester_average", 0);
			frappe.model.set_value(cdt, cdn, "is_approved", 0);
		}
		_inject_score_inputs(frm, cdt, cdn);
	},
});

// ---------------------------------------------------------------------------
// Score input injection
// ---------------------------------------------------------------------------

function _inject_score_inputs(frm, cdt, cdn) {
	const components = frm.doc.evaluation_components;
	if (!components || components.length === 0) return;

	const row = frappe.get_doc(cdt, cdn);
	const wrapper = frm.fields_dict.grade_rows.grid.get_row(cdn);
	if (!wrapper) return;

	// Target the expanded form area of the child row
	const $form = wrapper.open_form && wrapper.open_form.$wrapper;
	if (!$form || !$form.length) return;

	// Remove any previously injected panel
	$form.find(".escola-score-panel").remove();

	let scores = {};
	try {
		scores = JSON.parse(row.scores_json || "{}") || {};
	} catch (e) {
		scores = {};
	}

	const disabled = row.is_absent ? "disabled" : "";

	let html = `<div class="escola-score-panel" style="margin: 12px 0 8px; padding: 16px; background: var(--bg-light-gray); border: 1px solid var(--border-color); border-radius: 8px;">
		<label style="font-size:12px; font-weight:700; color:var(--text-color); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
			${__("Notas por Componente")}
		</label>
		<div style="display:flex; flex-wrap:wrap; gap:12px;">`;

	for (const comp of components) {
		const val = scores[comp.component_name] !== undefined
			? scores[comp.component_name]
			: "";
		const maxS = comp.max_score || 20;
		html += `
			<div style="display:flex; flex-direction:column; min-width:130px; background: var(--card-bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
				<span style="font-size:11px; font-weight:600; color:var(--text-color); margin-bottom:4px; display:flex; justify-content:space-between;">
					${frappe.utils.escape_html(comp.component_name)}
					<span style="opacity:0.6; font-weight:400; font-size:10px;">${comp.weight || 0}%</span>
				</span>
                <div style="display:flex; align-items:center;">
				    <input
					    type="number" min="0" max="${maxS}" step="0.01"
					    ${disabled}
					    data-component="${frappe.utils.escape_html(comp.component_name)}"
					    value="${val}"
					    style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:14px; outline:none; transition: border 0.2s;"
                        onfocus="this.style.borderColor='var(--primary-color)'"
                        onblur="this.style.borderColor='var(--border-color)'"
				    />
                    <span style="font-size:12px; color:var(--text-muted); margin-left:6px; font-weight: 500;">/ ${maxS}</span>
                </div>
			</div>`;
	}

	html += `</div>
		<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: space-between;">
			<span style="font-size:12px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${__("Média Calculada")}</span>
			<span class="escola-avg-display" style="font-size: 16px; font-weight: 700; color: var(--primary-color); background: rgba(36,144,239,0.1); padding: 4px 12px; border-radius: 12px;">${
				row.trimester_average !== null && row.trimester_average !== undefined
					? row.trimester_average
					: "—"
			}</span>
		</div>
	</div>`;

	const $panel = $(html);

	// Debounced recalc on input change
	let _debounce;
	$panel.find("input[data-component]").on("input", function () {
		clearTimeout(_debounce);
		_debounce = setTimeout(() => {
			const updated = {};
			$panel.find("input[data-component]").each(function () {
				const name = $(this).data("component");
				const v = $(this).val();
				updated[name] = v === "" ? null : parseFloat(v);
			});
			_recalc_row(frm, cdt, cdn, updated, $panel);
		}, 300);
	});

	// Append after the last visible field in the expanded form
	$form.append($panel);
}

function _recalc_row(frm, cdt, cdn, scores, $panel) {
	const components = frm.doc.evaluation_components;
	if (!components || components.length === 0) return;

	frappe.model.set_value(cdt, cdn, "scores_json", JSON.stringify(scores));

	const totalWeight = components.reduce((s, c) => s + (c.weight || 0), 0);
	if (totalWeight === 0) return;

	let weightedSum = 0;
	let usedWeight = 0;
	for (const comp of components) {
		const score = scores[comp.component_name];
		if (score === null || score === undefined || isNaN(score)) continue;
		const maxS = comp.max_score || 20;
		const normalised = maxS ? (score / maxS) * 20 : 0;
		weightedSum += normalised * (comp.weight || 0);
		usedWeight += comp.weight || 0;
	}

	let avg = null;
	if (usedWeight > 0) {
		avg = Math.round((weightedSum / usedWeight) * 100) / 100;
	}

	frappe.model.set_value(cdt, cdn, "trimester_average", avg);
	frappe.model.set_value(cdt, cdn, "is_approved", avg !== null && avg >= 10 ? 1 : 0);

	if ($panel) {
		$panel.find(".escola-avg-display").text(avg !== null ? avg : "—");
	}

	frm.refresh_field("grade_rows");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function set_queries(frm) {
	frm.set_query("academic_term", () => {
		const filters = { is_active: 1 };
		if (frm.doc.academic_year) filters.academic_year = frm.doc.academic_year;
		return { filters };
	});

	const cg_filters = { is_active: 1 };
	if (frm.doc.academic_year) cg_filters.academic_year = frm.doc.academic_year;
	if (frm.doc.school_class) cg_filters.school_class = frm.doc.school_class;
	frm.set_query("class_group", () => ({ filters: cg_filters }));

	frm.set_query("school_class", () => ({ filters: { is_active: 1 } }));
}

async function load_grade_rows(frm) {
	if (!frm.doc.class_group || !frm.doc.academic_year || !frm.doc.teacher) {
		frappe.msgprint(
			__("Por favor, seleccione o Professor, a Turma e o Ano Lectivo antes de carregar as linhas.")
		);
		return;
	}

	const r = await frappe.call({
		method:
			"escola.escola.doctype.grade_entry.grade_entry.get_students_and_subjects",
		args: {
			class_group: frm.doc.class_group,
			academic_year: frm.doc.academic_year,
			teacher: frm.doc.teacher,
		},
	});

	if (!r.message) return;

	if (r.message.error === "no_students") {
		frappe.msgprint(
			__("Não foram encontrados alunos activos para a turma <b>{0}</b> no ano lectivo seleccionado. "
				+ "Verifique as Alocações de Turma.", [frm.doc.class_group])
		);
		return;
	}
	if (r.message.error === "no_subjects") {
		frappe.msgprint(
			__("Não existem disciplinas atribuídas à turma <b>{0}</b>. "
				+ "Crie as Atribuições de Disciplina primeiro.", [frm.doc.class_group])
		);
		return;
	}

	const existing = new Set(
		(frm.doc.grade_rows || []).map((r) => r.student + "||" + r.subject)
	);

	let added = 0;
	for (const combo of r.message) {
		const key = combo.student + "||" + combo.subject;
		if (!existing.has(key)) {
			const row = frappe.model.add_child(
				frm.doc,
				"Grade Entry Row",
				"grade_rows"
			);
			row.student = combo.student;
			row.subject = combo.subject;
			if (combo.teacher) row.teacher = combo.teacher;
			added++;
		}
	}

	frm.refresh_field("grade_rows");

	if (added > 0) {
		frappe.show_alert({
			message: __("{0} linha(s) adicionada(s) à pauta.", [added]),
			indicator: "green",
		});
	} else {
		frappe.show_alert({
			message: __(
				"Todas as combinações de aluno/disciplina já constam da pauta."
			),
			indicator: "blue",
		});
	}
}
