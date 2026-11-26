package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.RuleRequest;
import com.kyf.knowyourfinance.dto.RuleResult;
import com.kyf.knowyourfinance.model.CategoryRule;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.service.CategoryRuleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.NoSuchElementException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CategoryRuleController.class)
class CategoryRuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CategoryRuleService service;

    @Test
    void listsTheRulesForAUser() throws Exception {
        when(service.list(1L)).thenReturn(List.of(new CategoryRule(1L, "walmart", TransactionCategory.SHOPPING)));

        mockMvc.perform(get("/api/rules").param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pattern").value("walmart"))
                .andExpect(jsonPath("$[0].category").value("SHOPPING"));
    }

    @Test
    void savesARuleAndReportsHowManyRowsItChanged() throws Exception {
        when(service.save(eq(1L), any(RuleRequest.class)))
                .thenReturn(new RuleResult(new CategoryRule(1L, "starbucks", TransactionCategory.DINING), 4));

        mockMvc.perform(post("/api/rules").param("userId", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pattern\":\"starbucks\",\"category\":\"DINING\",\"applyToExisting\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rule.pattern").value("starbucks"))
                .andExpect(jsonPath("$.updated").value(4));
    }

    @Test
    void anInvalidRuleReturns400WithTheReason() throws Exception {
        when(service.save(eq(1L), any(RuleRequest.class)))
                .thenThrow(new IllegalArgumentException("Choose a category."));

        mockMvc.perform(post("/api/rules").param("userId", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pattern\":\"walmart\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Choose a category."));
    }

    @Test
    void deletesARule() throws Exception {
        mockMvc.perform(delete("/api/rules/9").param("userId", "1"))
                .andExpect(status().isNoContent());

        verify(service).delete(1L, 9L);
    }

    @Test
    void deletingAMissingRuleReturns404() throws Exception {
        doThrow(new NoSuchElementException("Rule not found.")).when(service).delete(1L, 9L);

        mockMvc.perform(delete("/api/rules/9").param("userId", "1"))
                .andExpect(status().isNotFound());
    }

    @Test
    void anInvalidUserReturns400() throws Exception {
        mockMvc.perform(get("/api/rules").param("userId", "0"))
                .andExpect(status().isBadRequest());
    }
}
