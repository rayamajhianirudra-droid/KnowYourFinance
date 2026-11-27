package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers FR-404 (delete a transaction), which had no automated test
 * before Milestone 4. Kept in its own class so the original controller
 * tests stay exactly as they were.
 */
@org.springframework.context.annotation.Import(com.kyf.knowyourfinance.auth.SecurityConfiguration.class)
@WebMvcTest(TransactionController.class)
@AuthenticatedTestAccount
class TransactionDeleteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionRepository transactionRepository;

    @Test
    void deletingAnExistingTransactionReturns204AndRemovesIt() throws Exception {
        when(transactionRepository.deleteOwned(7L, 1L)).thenReturn(1);

        mockMvc.perform(delete("/api/transactions/7").with(csrf()))
                .andExpect(status().isNoContent());

        verify(transactionRepository).deleteOwned(7L, 1L);
    }

    @Test
    void deletingAMissingTransactionReturns404AndDeletesNothing() throws Exception {
        when(transactionRepository.deleteOwned(404L, 1L)).thenReturn(0);

        mockMvc.perform(delete("/api/transactions/404").with(csrf()))
                .andExpect(status().isNotFound());

        verify(transactionRepository).deleteOwned(404L, 1L);
    }
}
