package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.DataSummary;
import com.kyf.knowyourfinance.dto.ResetResult;
import com.kyf.knowyourfinance.service.DataResetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@org.springframework.context.annotation.Import(com.kyf.knowyourfinance.auth.SecurityConfiguration.class)
@WebMvcTest(DataResetController.class)
@AuthenticatedTestAccount
class DataResetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataResetService service;

    @Test
    void summaryReturnsTheCounts() throws Exception {
        when(service.summary(1L)).thenReturn(new DataSummary(38, 3, 0, 0));

        mockMvc.perform(get("/api/data/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactions").value(38))
                .andExpect(jsonPath("$.budgets").value(3));
    }

    @Test
    void deleteWithTheConfirmWordRemovesTheData() throws Exception {
        when(service.reset(1L, false)).thenReturn(new ResetResult(38, 3, false));

        mockMvc.perform(delete("/api/data").with(csrf()).param("confirm", "DELETE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedTransactions").value(38))
                .andExpect(jsonPath("$.deletedBudgets").value(3))
                .andExpect(jsonPath("$.nameRemoved").value(false));
    }

    @Test
    void deleteCanAlsoRemoveTheName() throws Exception {
        when(service.reset(1L, true)).thenReturn(new ResetResult(0, 0, true));

        mockMvc.perform(delete("/api/data").with(csrf())
                        .param("confirm", "DELETE").param("includeName", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nameRemoved").value(true));
    }

    @Test
    void deleteWithoutTheConfirmWordIsRejectedAndDeletesNothing() throws Exception {
        mockMvc.perform(delete("/api/data").with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Type DELETE to confirm that you want to remove all your data."));

        verify(service, never()).reset(anyLong(), anyBoolean());
    }

    @Test
    void theConfirmWordMustMatchExactly() throws Exception {
        mockMvc.perform(delete("/api/data").with(csrf()).param("confirm", "delete"))
                .andExpect(status().isBadRequest());

        verify(service, never()).reset(anyLong(), anyBoolean());
    }

}
